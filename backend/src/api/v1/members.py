import os
import secrets
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import func, delete
from sqlmodel import Session, select

from dependency.db import session_dep
from dependency.current_user import official_user_dep
from dependency.access import (
    duration_to_seconds,
    extend_expiry,
    access_status,
    is_official,
    VALID_UNITS,
)
from Schema.bill import User, BillMember, Expense
from Schema.invite import Invite
from Schema.session import Session as SessionRow
from Schema.api import (
    ApiResponse,
    PaginatedResponse,
    MemberOut,
    MemberCreate,
    MemberWithStatsOut,
    Duration,
    InviteCreateRequest,
    InviteResponse,
    JoinRequest,
)

routers = APIRouter()

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000").rstrip("/")


def _user_to_dict(user: User) -> dict:
    return {
        "id": str(user.id),
        "email": user.email,
        "name": user.name,
        "accountType": user.account_type or "",
        "hyperId": user.hyper_id or "",
    }


def _member_out(user: User, session: Session) -> dict:
    bill_count = session.exec(
        select(func.count())
        .select_from(BillMember)
        .where(BillMember.user_id == user.id)
    ).one()
    total_paid = session.exec(
        select(func.coalesce(func.sum(Expense.amount), 0)).where(
            Expense.paid_by_user_id == user.id
        )
    ).one()
    return MemberWithStatsOut(
        id=str(user.id),
        name=user.name,
        email=user.email,
        billCount=int(bill_count),
        totalPaid=float(total_paid or 0),
        isOfficial=is_official(user),
        isKicked=user.is_kicked,
        accessExpiresAt=user.access_expires_at.isoformat() if user.access_expires_at else None,
        accessStatus=access_status(user),
        group=user.group or "unofficial",
    ).model_dump()


@routers.get("")
def list_members(
    session: session_dep,
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
):
    """List all known members (users) with per-member stats + access info."""
    query = select(User)
    if search:
        like = f"%{search}%"
        query = query.where((User.name.ilike(like)) | (User.email.ilike(like)))
    query = query.order_by(User.name)

    total = session.exec(select(func.count()).select_from(query.subquery())).one()
    total_pages = max(1, (total + pageSize - 1) // pageSize)

    users = session.exec(query.offset((page - 1) * pageSize).limit(pageSize)).all()
    data = [_member_out(u, session) for u in users]

    return PaginatedResponse(
        data=data, total=total, page=page, pageSize=pageSize, totalPages=total_pages
    )


@routers.get("/{member_id}")
def get_member(member_id: str, session: session_dep):
    user = session.get(User, member_id)
    if not user:
        raise HTTPException(status_code=404, detail="Member not found")
    return _member_out(user, session)


@routers.post("", response_model=ApiResponse)
def create_member(
    req: MemberCreate,
    session: session_dep,
    _admin: official_user_dep,
):
    """Add a standalone member directly (official members only).

    Idempotent on email. The created member is unofficial with permanent
    access, but cannot log in until they join via an invite or HYPER.
    """
    if not req.email:
        raise HTTPException(status_code=400, detail="Email is required")
    if req.group not in ("hyper", "unofficial", "private"):
        raise HTTPException(status_code=400, detail="Invalid group")
    existing = session.exec(select(User).where(User.email == req.email)).first()
    if existing:
        return ApiResponse(
            success=True,
            data=MemberOut(
                id=str(existing.id), name=existing.name, email=existing.email
            ).model_dump(),
            message="Member already exists",
        )

    user = User(name=req.name, email=req.email, group=req.group)
    session.add(user)
    session.commit()
    session.refresh(user)
    return ApiResponse(
        success=True,
        data=MemberOut(id=str(user.id), name=user.name, email=user.email).model_dump(),
        message="Member added",
    )


# --- Invite / join --------------------------------------------------------


@routers.post("/invite", response_model=ApiResponse)
def create_invite(req: InviteCreateRequest, session: session_dep, admin: official_user_dep):
    """Generate an invite link (official members only).

    Body: { amount, unit, group } where unit is hour | day | week | year and
    group is hyper | unofficial | private. Anyone who joins via the link gets
    access for that duration from the moment they join, and is assigned to the
    given visibility group.
    """
    try:
        seconds = duration_to_seconds(req.amount, req.unit)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    if req.group not in ("hyper", "unofficial", "private"):
        raise HTTPException(status_code=400, detail="Invalid group")

    invite = Invite(
        token=secrets.token_urlsafe(24),
        created_by=admin.id,
        access_duration_seconds=seconds,
        group=req.group,
    )
    session.add(invite)
    session.commit()
    session.refresh(invite)

    link = f"{FRONTEND_URL}/join?token={invite.token}"
    return ApiResponse(
        success=True,
        data=InviteResponse(
            token=invite.token,
            link=link,
            accessDurationSeconds=invite.access_duration_seconds,
            createdAt=invite.created_at.isoformat(),
        ).model_dump(),
        message="Invite link generated",
    )


@routers.post("/join", response_model=ApiResponse)
def join_via_invite(req: JoinRequest, session: session_dep):
    """Public endpoint: join as an unofficial member using an invite token.

    Finds-or-creates a user by email, sets their access to expire at
    now + invite.access_duration_seconds, and issues a local session token.
    """
    invite = session.exec(select(Invite).where(Invite.token == req.token)).first()
    if not invite:
        raise HTTPException(status_code=404, detail="Invalid or unknown invite link")

    if not req.email.strip():
        raise HTTPException(status_code=400, detail="Email is required")
    if not req.name.strip():
        raise HTTPException(status_code=400, detail="Name is required")
    if len(req.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    email = req.email.strip()
    name = req.name.strip()

    user = session.exec(select(User).where(User.email == email)).first()
    if not user:
        user = User(name=name, email=email)
        session.add(user)
        session.flush()
    elif is_official(user):
        # Already a HYPER member — they don't need invite access; just return
        # their info without a session (they authenticate with HYPER).
        return ApiResponse(
            success=True,
            data={"token": "", "user": _user_to_dict(user)},
            message="You already have an official HYPER account. Please log in via HYPER.",
        )
    elif user.is_kicked:
        # Banned members may not use an invite link to restore access. An
        # official must explicitly unban them first.
        raise HTTPException(
            status_code=403,
            detail="This account has been banned. Please contact an administrator to restore access.",
        )

    # Grant/refresh access for the invite duration.
    from datetime import timedelta

    user.access_expires_at = datetime.now(timezone.utc) + timedelta(
        seconds=invite.access_duration_seconds
    )
    if not user.name or user.name == user.email:
        user.name = name
    # Store the local password so this unofficial member can log back in via
    # the dedicated unofficial login endpoint.
    from dependency.passwords import hash_password

    user.password_hash = hash_password(req.password)
    # Assign the visibility group baked into this invite.
    user.group = invite.group or "unofficial"
    session.add(user)

    # Issue a local session token (replace any existing sessions for simplicity).
    session.exec(delete(SessionRow).where(SessionRow.user_id == user.id))
    token = secrets.token_urlsafe(32)
    session.add(SessionRow(token=token, user_id=user.id))

    invite.use_count = (invite.use_count or 0) + 1
    session.add(invite)

    session.commit()
    session.refresh(user)

    return ApiResponse(
        success=True,
        data={"token": token, "user": _user_to_dict(user)},
        message="Welcome! You now have access to Invoicely.",
    )


# --- Member management (official only) ------------------------------------


@routers.post("/{member_id}/ban", response_model=ApiResponse)
def ban_member(member_id: str, session: session_dep, _admin: official_user_dep):
    user = session.get(User, member_id)
    if not user:
        raise HTTPException(status_code=404, detail="Member not found")
    if is_official(user):
        raise HTTPException(status_code=400, detail="Official (HYPER) members cannot be banned")

    user.is_kicked = True
    session.add(user)
    # Revoke all their sessions so they're logged out immediately.
    session.exec(delete(SessionRow).where(SessionRow.user_id == user.id))
    session.commit()
    return ApiResponse(success=True, data=_member_out(user, session), message="Member banned")


@routers.post("/{member_id}/unban", response_model=ApiResponse)
def unban_member(member_id: str, session: session_dep, _admin: official_user_dep):
    """Lift a ban so the member can access Invoicely again.

    Restores access using the member's previous expiry (or permanent if they
    had none). Officials must re-issue a session by having the member log in
    again via HYPER or an invite.
    """
    user = session.get(User, member_id)
    if not user:
        raise HTTPException(status_code=404, detail="Member not found")
    if is_official(user):
        raise HTTPException(status_code=400, detail="Official members cannot be banned")

    user.is_kicked = False
    session.add(user)
    session.commit()
    session.refresh(user)
    return ApiResponse(success=True, data=_member_out(user, session), message="Member unbanned")


@routers.post("/{member_id}/extend", response_model=ApiResponse)
def extend_member(
    member_id: str,
    req: Duration,
    session: session_dep,
    _admin: official_user_dep,
):
    user = session.get(User, member_id)
    if not user:
        raise HTTPException(status_code=404, detail="Member not found")
    if is_official(user):
        raise HTTPException(status_code=400, detail="Official members already have permanent access")
    if user.is_kicked:
        raise HTTPException(
            status_code=400,
            detail="This member is banned. Unban them first before extending access.",
        )

    try:
        user.access_expires_at = extend_expiry(user, req.amount, req.unit)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    session.add(user)
    session.commit()
    session.refresh(user)
    return ApiResponse(success=True, data=_member_out(user, session), message="Access extended")


@routers.post("/{member_id}/permanent", response_model=ApiResponse)
def make_permanent(member_id: str, session: session_dep, _admin: official_user_dep):
    user = session.get(User, member_id)
    if not user:
        raise HTTPException(status_code=404, detail="Member not found")
    if is_official(user):
        raise HTTPException(status_code=400, detail="Official members already have permanent access")
    if user.is_kicked:
        raise HTTPException(
            status_code=400,
            detail="This member is banned. Unban them first before granting permanent access.",
        )

    user.access_expires_at = None
    session.add(user)
    session.commit()
    session.refresh(user)
    return ApiResponse(success=True, data=_member_out(user, session), message="Member granted permanent access")
