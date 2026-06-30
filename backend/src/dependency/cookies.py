"""HttpOnly session-cookie helpers.

The backend issues an opaque session token and stores it in an HttpOnly,
Secure cookie so it is never exposed to JavaScript (mitigating XSS token
theft). The frontend never reads or sends the token manually; the browser
attaches the cookie automatically (``withCredentials``).

Cross-domain vs same-site
--------------------------
If the frontend and backend are on **different registrable domains** (e.g.
``invoicely.pages.dev`` and ``api.invoicely.dev``), browsers will NOT send a
cookie cross-origin unless it is ``SameSite=None; Secure``. Set::

    COOKIE_CROSS_DOMAIN=true   # forces SameSite=None and Secure=true
    COOKIE_SECURE=true         # (implied by CROSS_DOMAIN) requires HTTPS

If they share a registrable domain (e.g. ``app.invoicely.app`` and
``api.invoicely.app``, or both on ``localhost``) you can leave
``COOKIE_CROSS_DOMAIN`` unset and keep the default ``SameSite=Lax``.

Configuration (env):
  COOKIE_NAME           — cookie name (default ``invoicely_session``)
  COOKIE_CROSS_DOMAIN   — "true" for different registrable domains
                          (forces SameSite=None + Secure; requires HTTPS).
  COOKIE_SECURE         — "true" to set the Secure flag (HTTPS only).
                          Implied by COOKIE_CROSS_DOMAIN. Default "false"
                          so local dev over http works.
  COOKIE_SAMESITE       — "lax" (default) | "strict" | "none". Ignored when
                          COOKIE_CROSS_DOMAIN=true (forced to "none").
  COOKIE_DOMAIN         — optional domain (e.g. ``.invoicely.app``); only
                          set this when frontend and backend share a parent
                          domain. Leave unset for different registrable
                          domains.
  COOKIE_MAX_AGE        — seconds until the browser drops the cookie
                          (default 30 days). The server-side session row is
                          the source of truth; the cookie is just a carrier.
"""

import os
from typing import Optional

from fastapi import HTTPException, Request, Response

COOKIE_NAME = os.getenv("COOKIE_NAME", "invoicely_session")
_DEFAULT_MAX_AGE = 30 * 24 * 3600


def _cross_domain() -> bool:
    return os.getenv("COOKIE_CROSS_DOMAIN", "false").lower() == "true"


def _secure() -> bool:
    if _cross_domain():
        return True  # SameSite=None requires Secure
    return os.getenv("COOKIE_SECURE", "false").lower() == "true"


def _samesite() -> str:
    if _cross_domain():
        return "none"
    val = os.getenv("COOKIE_SAMESITE", "lax").lower()
    if val not in ("lax", "strict", "none"):
        return "lax"
    if val == "none" and not _secure():
        # SameSite=None without Secure is rejected by browsers; fail safe.
        raise RuntimeError(
            "COOKIE_SAMESITE=none requires Secure (HTTPS). Set "
            "COOKIE_SECURE=true or COOKIE_CROSS_DOMAIN=true."
        )
    return val


def _domain() -> Optional[str]:
    return os.getenv("COOKIE_DOMAIN") or None


def _max_age() -> int:
    try:
        return int(os.getenv("COOKIE_MAX_AGE", str(_DEFAULT_MAX_AGE)))
    except ValueError:
        return _DEFAULT_MAX_AGE


def set_session_cookie(response: Response, token: str) -> None:
    """Attach the session token to the response as an HttpOnly cookie."""
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        max_age=_max_age(),
        path="/",
        domain=_domain(),
        secure=_secure(),
        httponly=True,
        samesite=_samesite(),
    )


def clear_session_cookie(response: Response) -> None:
    """Delete the session cookie from the client."""
    response.delete_cookie(
        key=COOKIE_NAME,
        path="/",
        domain=_domain(),
    )


def get_session_token(
    request: Request,
    authorization: Optional[str] = None,
) -> str:
    """Resolve the session token from the cookie, falling back to the
    ``Authorization: Bearer`` header (kept for API clients that can't use
    cookies). Raises 401 if neither is present.
    """
    cookie_token = request.cookies.get(COOKIE_NAME)
    if cookie_token:
        return cookie_token
    if authorization:
        scheme, _, value = authorization.partition(" ")
        if scheme.lower() == "bearer" and value:
            return value
    raise HTTPException(
        status_code=401,
        detail="Missing session cookie or Authorization header",
    )
