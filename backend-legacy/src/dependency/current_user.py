"""Dependency that resolves the authenticated local User.

Authentication is based solely on **backend-issued opaque session tokens**.
The token is delivered either via an HttpOnly cookie (set by the login/join
endpoints — preferred, never visible to JS) or, as a fallback for non-browser
API clients, via ``Authorization: Bearer <token>``. The token is looked up in
the ``session`` table; the backend never trusts a JWT presented by the client.

Access is validated on every request: banned or expired unofficial members
get a 401/403. Official members always pass.
"""

from typing import Annotated, Optional

from fastapi import Depends, Header, HTTPException, Request
from sqlmodel import Session, select

from dependency.db import get_session
from dependency.cookies import get_session_token, clear_session_cookie
from dependency.access import has_access, is_official
from Schema.bill import User
from Schema.session import Session as SessionRow


def _lookup_session(session: Session, token: str) -> Optional[User]:
    row = session.get(SessionRow, token)
    if not row:
        return None
    return session.get(User, row.user_id)


def get_current_user(
    request: Request,
    authorization: Optional[str] = Header(default=None),
    session: Session = Depends(get_session),
) -> User:
    token = get_session_token(request, authorization)
    user = _lookup_session(session, token)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    if not has_access(user):
        raise HTTPException(
            status_code=401, detail="Your access has expired or been revoked"
        )
    return user


def require_official(user: User = Depends(get_current_user)) -> User:
    """Only official (HYPER) members may manage other members."""
    if not is_official(user):
        raise HTTPException(
            status_code=403, detail="Only official members can manage members"
        )
    return user


current_user_dep = Annotated[User, Depends(get_current_user)]
official_user_dep = Annotated[User, Depends(require_official)]

__all__ = [
    "current_user_dep",
    "official_user_dep",
    "get_current_user",
    "require_official",
    "clear_session_cookie",
]
