"""Dependency that resolves the authenticated local User.

Supports two credential kinds, both delivered as `Authorization: Bearer <t>`:
  1. A HYPER JWT (official members) — decoded via hyper_auth.
  2. An opaque local session token (unofficial, invite-joined members) —
     looked up in the `session` table.

Access is validated on every request: banned or expired unofficial members
get a 403. Official members always pass.
"""

from datetime import datetime, timezone
from typing import Annotated, Optional

from fastapi import Depends, HTTPException
from sqlmodel import Session, select

from dependency.db import get_session
from dependency.hyper_auth import get_token_from_header, decode_hyper_token
from dependency.access import has_access, is_official
from Schema.bill import User
from Schema.session import Session as SessionRow


def _lookup_session(session: Session, token: str) -> Optional[User]:
    row = session.get(SessionRow, token)
    if not row:
        return None
    return session.get(User, row.user_id)


def get_current_user(
    token: str = Depends(get_token_from_header),
    session: Session = Depends(get_session),
) -> User:
    # 1. Try a local session token first (unofficial members).
    user = _lookup_session(session, token)
    if not user:
        # 2. Fall back to decoding a HYPER JWT (official members).
        payload = decode_hyper_token(token)
        exp = payload.get("exp")
        if exp and datetime.fromtimestamp(exp, tz=timezone.utc) < datetime.now(tz=timezone.utc):
            raise HTTPException(status_code=401, detail="Access token expired")
        email = payload.get("email", "")
        if not email:
            raise HTTPException(status_code=401, detail="Token missing email claim")
        user = session.exec(select(User).where(User.email == email)).first()
        if not user:
            raise HTTPException(status_code=401, detail="User not found")

    if not has_access(user):
        raise HTTPException(status_code=401, detail="Your access has expired or been revoked")
    return user


def require_official(user: User = Depends(get_current_user)) -> User:
    """Only official (HYPER) members may manage other members."""
    if not is_official(user):
        raise HTTPException(status_code=403, detail="Only official members can manage members")
    return user


current_user_dep = Annotated[User, Depends(get_current_user)]
official_user_dep = Annotated[User, Depends(require_official)]
