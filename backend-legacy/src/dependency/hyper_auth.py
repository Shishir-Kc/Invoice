"""HYPER (Arcademia) auth integration.

Proxies login to the external HYPER API. The backend NEVER trusts a JWT
presented by the client. Instead, on a successful HYPER login the backend
mints its own opaque session token (see ``api/v1/auth.py`` and the ``session``
table) and returns that to the frontend. Subsequent requests authenticate via
that opaque token looked up in the DB — there is no JWT verification path and
therefore no way to forge a token client-side.

This module only contains:
  - ``login_with_hyper``: forwards credentials to HYPER and returns a
    normalized user payload (the HYPER access token is used only here, in the
    trusted server-to-HYPER call, and is discarded).
  - ``get_token_from_header``: extracts the backend-issued Bearer token.
"""

import os
from typing import Optional

import httpx
from fastapi import HTTPException, Header

HYPER_API_URL = os.getenv("HYPER_API_URL", "https://api.arcademia.app")


class HyperUser:
    """Normalized HYPER user shape exposed to the Invoicely frontend."""

    def __init__(self, id: str, email: str, name: str, account_type: str = ""):
        self.id = id
        self.email = email
        self.name = name
        self.account_type = account_type

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "email": self.email,
            "name": self.name,
            "accountType": self.account_type,
        }


async def login_with_hyper(email: str, password: str) -> dict:
    """Call the HYPER login endpoint and return a normalized auth payload.

    Returns: { "user": { id, email, name, accountType } }

    Raises HTTPException with a structured `detail` on failure:
        { "code": <invalid_email|password_required|invalid_credentials|hyper_error>,
          "message": <friendly message>,
          "fields": { <field>: <message>, ... } }

    Note: the HYPER access token is intentionally NOT returned to callers;
    the backend issues its own session token after a successful HYPER login.
    """
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                f"{HYPER_API_URL}/api/auth/login",
                json={"email": email, "password": password},
                headers={"Content-Type": "application/json"},
            )
    except httpx.RequestError:
        # Don't leak the underlying transport error to clients.
        raise HTTPException(
            status_code=502,
            detail={
                "code": "hyper_unreachable",
                "message": "Could not reach the HYPER auth service. Please try again.",
                "fields": {},
            },
        )

    if resp.status_code >= 400:
        raise HTTPException(
            status_code=resp.status_code,
            detail=_parse_hyper_error(resp),
        )

    body = resp.json()
    user_in = body.get("user") or {}
    token = body.get("accessToken")

    if not token:
        # Generic message — do not echo HYPER's raw body.
        raise HTTPException(
            status_code=502,
            detail={
                "code": "hyper_error",
                "message": "HYPER did not return an access token.",
                "fields": {},
            },
        )

    user = HyperUser(
        id=user_in.get("id", ""),
        email=user_in.get("email", ""),
        name=(user_in.get("username") or user_in.get("email") or "").strip(),
        account_type=user_in.get("accountType") or user_in.get("account_type") or "",
    )
    # Return the HYPER token too — the caller (login endpoint) uses it only to
    # confirm HYPER accepted the credentials; it then discards it and issues a
    # local session token. It must never be sent to the frontend.
    return {"token": token, "user": user.to_dict()}


def _parse_hyper_error(resp: httpx.Response) -> dict:
    """Map HYPER's error response into a structured detail dict.

    HYPER shapes observed:
      {"errors": {"email":   ["Invalid email"]}}            -> invalid_email
      {"errors": {"password":["Password is required"]}}      -> password_required
      {"errors": {"general": ["Invalid email or password"]}} -> invalid_credentials
    """
    code = "hyper_error"
    fields: dict = {}
    message = "Login failed."

    try:
        body = resp.json()
    except Exception:
        return {"code": code, "message": message, "fields": fields}

    errors = body.get("errors") or {}
    if isinstance(errors, dict):
        # Collect per-field messages.
        for field, msgs in errors.items():
            if isinstance(msgs, list) and msgs:
                fields[field] = str(msgs[0])
            elif isinstance(msgs, str):
                fields[field] = msgs

        if "email" in fields:
            code = "invalid_email"
            message = fields["email"]
        elif "password" in fields:
            code = "password_required"
            message = fields["password"]
        elif "general" in fields:
            code = "invalid_credentials"
            message = fields["general"]
        elif fields:
            code = "hyper_error"
            message = next(iter(fields.values()))
    elif body.get("message"):
        message = body["message"]

    return {"code": code, "message": message, "fields": fields}


def get_token_from_header(authorization: Optional[str] = Header(default=None)) -> str:
    """Extract a Bearer token from the Authorization header.

    The token is a backend-issued opaque session token (never a client JWT).
    """
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing Authorization header")
    scheme, _, value = authorization.partition(" ")
    if scheme.lower() != "bearer" or not value:
        raise HTTPException(
            status_code=401,
            detail="Invalid Authorization header. Expected 'Bearer <token>'",
        )
    return value
