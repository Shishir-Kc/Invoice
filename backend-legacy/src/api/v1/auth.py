from fastapi import APIRouter, HTTPException, Depends, Response
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import or_
from sqlmodel import Session, select, delete

from dependency.hyper_auth import login_with_hyper
from dependency.db import session_dep
from dependency.current_user import current_user_dep, clear_session_cookie
from dependency.access import has_access, is_official
from dependency.passwords import verify_password
from dependency.ratelimit import rate_limit_login
from dependency.cookies import set_session_cookie
from Schema.api import ApiResponse, UnofficialLoginRequest
from Schema.bill import User
from Schema.session import Session as SessionRow
import secrets

routers = APIRouter()


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


def _user_to_dict(user: User) -> dict:
    return {
        "id": str(user.id),
        "email": user.email,
        "name": user.name,
        "accountType": user.account_type or "",
        "hyperId": user.hyper_id or "",
    }


def _issue_session(session: Session, user: User) -> str:
    """Replace any existing sessions for ``user`` and return a fresh token."""
    session.exec(delete(SessionRow).where(SessionRow.user_id == user.id))
    token = secrets.token_urlsafe(32)
    session.add(SessionRow(token=token, user_id=user.id))
    return token


@routers.post("/login", response_model=ApiResponse)
async def login(
    req: LoginRequest,
    response: Response,
    session: session_dep,
    _rl: None = Depends(rate_limit_login),
):
    """Login via HYPER, then upsert the user into our DB and issue a local
    session token stored in an HttpOnly cookie.

    Flow:
      1. Call HYPER. If HYPER rejects the credentials `login_with_hyper`
         raises an HTTPException — so NO user is created and login is blocked.
      2. If HYPER succeeds, look up a local user by email OR hyper_id and
         sync any missing HYPER fields (hyper_id, account_type, name).
      3. Issue a backend-owned opaque session token, store it in an HttpOnly
         cookie, and return the user. The HYPER access token is used only to
         confirm HYPER accepted the credentials and is then discarded — it is
         never sent to the client, so it cannot be forged or stolen and
         replayed against us.
    """
    auth = await login_with_hyper(req.email, req.password)
    hyper_user = auth["user"]  # { id, email, name, accountType }

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

    token = _issue_session(session, db_user)
    session.commit()
    session.refresh(db_user)

    set_session_cookie(response, token)
    return ApiResponse(
        success=True,
        data={"user": _user_to_dict(db_user)},
        message="Login successful",
    )


@routers.get("/me", response_model=ApiResponse)
def me(user: current_user_dep):
    """Return the current user from our DB (authenticated via the cookie)."""
    return ApiResponse(success=True, data=_user_to_dict(user), message="Authenticated")


@routers.post("/logout", response_model=ApiResponse)
def logout(response: Response, user: current_user_dep, session: session_dep):
    """Delete the current session row and clear the cookie."""
    # Remove the user's session rows (there should be one, but clear all to
    # be safe). The cookie token is the one currently in use.
    session.exec(delete(SessionRow).where(SessionRow.user_id == user.id))
    session.commit()
    clear_session_cookie(response)
    return ApiResponse(success=True, data=None, message="Logged out")


@routers.post("/login-unofficial", response_model=ApiResponse)
def login_unofficial(
    req: UnofficialLoginRequest,
    response: Response,
    session: session_dep,
    _rl: None = Depends(rate_limit_login),
):
    """Log in an unofficial (invite-joined) member with email + password.

    Official (HYPER) members cannot use this endpoint — they authenticate via
    HYPER. On success a fresh local session token is issued, stored in an
    HttpOnly cookie, and the user dict is returned. Access is enforced on
    every request via ``current_user_dep``, so banned/expired members get
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

    # Use a single generic message to avoid user enumeration via response body.
    invalid = "Invalid email or password"
    if not user or not ok:
        raise HTTPException(status_code=401, detail=invalid)
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
        if user.is_kicked:
            raise HTTPException(
                status_code=403,
                detail="This account has been banned. Please contact an administrator.",
            )
        raise HTTPException(
            status_code=403,
            detail="Your access has expired. Please ask an administrator to renew it.",
        )

    token = _issue_session(session, user)
    session.commit()
    session.refresh(user)

    set_session_cookie(response, token)
    return ApiResponse(
        success=True,
        data={"user": _user_to_dict(user)},
        message="Login successful",
    )
