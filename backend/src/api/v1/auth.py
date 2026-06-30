from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import or_
from sqlmodel import Session, select, delete

from dependency.hyper_auth import login_with_hyper
from dependency.db import session_dep
from dependency.current_user import current_user_dep
from dependency.access import has_access, is_official
from dependency.passwords import verify_password
from Schema.api import ApiResponse, UnofficialLoginRequest
from Schema.bill import User
from Schema.session import Session as SessionRow
import secrets

routers = APIRouter()


class LoginRequest(BaseModel):
    email: str
    password: str


def _user_to_dict(user: User) -> dict:
    return {
        "id": str(user.id),
        "email": user.email,
        "name": user.name,
        "accountType": user.account_type or "",
        "hyperId": user.hyper_id or "",
    }


@routers.post("/login", response_model=ApiResponse)
async def login(req: LoginRequest, session: session_dep):
    """Login via HYPER, then upsert the user into our DB.

    Flow:
      1. Call HYPER. If HYPER rejects the credentials (invalid email /
         wrong password / "email not valid") `login_with_hyper` raises an
         HTTPException — so NO user is created and login is blocked.
      2. If HYPER succeeds, look up a local user by email OR hyper_id.
         - Found  → sync any missing HYPER fields (hyper_id, account_type,
           name) and return that user.
         - Not found → HYPER confirmed the user exists, so create a new
           local user from the HYPER response (name, email, hyper_id,
           account_type).
      3. Return the HYPER access token + our DB user.
    """
    auth = await login_with_hyper(req.email, req.password)
    hyper_user = auth["user"]  # { id, email, name, accountType }
    token = auth["token"]

    hyper_id = hyper_user.get("id") or ""
    email = hyper_user.get("email") or ""
    name = hyper_user.get("name") or email
    account_type = hyper_user.get("accountType") or ""

    if not email:
        raise HTTPException(status_code=400, detail="HYPER response missing email")

    # Look up by email OR hyper_id (when available).
    clause = (
        or_(User.email == email, User.hyper_id == hyper_id)
        if hyper_id
        else (User.email == email)
    )
    existing = session.exec(select(User).where(clause)).first()

    if existing:
        changed = False
        if not existing.hyper_id and hyper_id:
            existing.hyper_id = hyper_id
            changed = True
        if not existing.account_type and account_type:
            existing.account_type = account_type
            changed = True
        if (not existing.name or existing.name == existing.email) and name:
            existing.name = name
            changed = True
        if changed:
            session.add(existing)
            session.commit()
            session.refresh(existing)
        db_user = existing
    else:
        # HYPER confirmed the user exists, but they're new to Invoicely.
        db_user = User(
            name=name,
            email=email,
            hyper_id=hyper_id or None,
            account_type=account_type or None,
        )
        session.add(db_user)
        session.commit()
        session.refresh(db_user)

    return ApiResponse(
        success=True,
        data={"token": token, "user": _user_to_dict(db_user)},
        message="Login successful",
    )


@routers.get("/me", response_model=ApiResponse)
def me(user: current_user_dep):
    """Return the current user from our DB.

    Works for both credential kinds (HYPER JWT for official members, local
    session token for unofficial members) via ``current_user_dep``. Includes
    ``hyperId`` so the frontend can tell official from unofficial.
    """
    return ApiResponse(success=True, data=_user_to_dict(user), message="Authenticated")


@routers.post("/login-unofficial", response_model=ApiResponse)
def login_unofficial(req: UnofficialLoginRequest, session: session_dep):
    """Log in an unofficial (invite-joined) member with email + password.

    Official (HYPER) members cannot use this endpoint — they authenticate via
    HYPER. On success a fresh local session token is issued (replacing any
    previous one) and returned together with the user dict. Access is enforced
    on every request via ``current_user_dep``, so banned/expired members get
    rejected at the token-validation stage even if their password is correct.
    """
    user = session.exec(select(User).where(User.email == req.email.strip())).first()
    # Always run a verify against a dummy hash to keep timing roughly constant
    # whether or not the account exists (avoids user-enumeration via timing).
    dummy_hash = (
        "scrypt$32768$8$1$00000000000000000000000000000000$"
        "0000000000000000000000000000000000000000000000000000000000000000"
    )
    ok = verify_password(req.password, user.password_hash or dummy_hash) if user else False

    if not user or not ok:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if is_official(user):
        raise HTTPException(
            status_code=400,
            detail="This account uses HYPER login. Please use the main login page.",
        )
    if not user.password_hash:
        raise HTTPException(
            status_code=400,
            detail="This account has no password set. Please join via an invite link first.",
        )
    if not has_access(user):
        # Banned or expired — surface a clear reason.
        if user.is_kicked:
            raise HTTPException(
                status_code=403,
                detail="This account has been banned. Please contact an administrator.",
            )
        raise HTTPException(
            status_code=403,
            detail="Your access has expired. Please ask an administrator to renew it.",
        )

    # Issue a fresh local session token (replace any existing sessions).
    session.exec(delete(SessionRow).where(SessionRow.user_id == user.id))
    token = secrets.token_urlsafe(32)
    session.add(SessionRow(token=token, user_id=user.id))
    session.commit()
    session.refresh(user)

    return ApiResponse(
        success=True,
        data={"token": token, "user": _user_to_dict(user)},
        message="Login successful",
    )
