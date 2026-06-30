"""HYPER (Arcademia) auth integration.

Proxies login to the external HYPER API at https://api.arcademia.app/api/auth/login
and provides helpers to inspect the returned JWT access token.
"""

import base64
import json
import os
from datetime import datetime, timezone
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

    Returns: { "token": <accessToken>, "user": { id, email, name, accountType } }

    Raises HTTPException with a structured `detail` on failure:
        { "code": <invalid_email|password_required|invalid_credentials|hyper_error>,
          "message": <friendly message>,
          "fields": { <field>: <message>, ... } }
    """
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                f"{HYPER_API_URL}/api/auth/login",
                json={"email": email, "password": password},
                headers={"Content-Type": "application/json"},
            )
    except httpx.RequestError as exc:
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
        return {"code": code, "message": resp.text or message, "fields": fields}

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


def _b64url_decode(segment: str) -> bytes:
    padding = "=" * (-len(segment) % 4)
    return base64.urlsafe_b64decode(segment + padding)


def decode_hyper_token(token: str) -> dict:
    """Decode a HYPER JWT payload (no signature verification — we trust HYPER)."""
    try:
        parts = token.split(".")
        if len(parts) < 2:
            raise ValueError("not a JWT")
        payload = json.loads(_b64url_decode(parts[1]))
        return payload
    except Exception as exc:
        raise HTTPException(status_code=401, detail=f"Invalid access token: {exc}")


def user_from_token(token: str) -> dict:
    """Decode the token and return a normalized user dict, checking expiry."""
    payload = decode_hyper_token(token)

    exp = payload.get("exp")
    if exp and datetime.fromtimestamp(exp, tz=timezone.utc) < datetime.now(tz=timezone.utc):
        raise HTTPException(status_code=401, detail="Access token expired")

    return {
        "id": payload.get("sub", ""),
        "email": payload.get("email", ""),
        "name": payload.get("email", ""),
        "accountType": payload.get("accountType") or payload.get("account_type") or "",
    }


def get_token_from_header(authorization: Optional[str] = Header(default=None)) -> str:
    """Extract a Bearer token from the Authorization header."""
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing Authorization header")
    scheme, _, value = authorization.partition(" ")
    if scheme.lower() != "bearer" or not value:
        raise HTTPException(status_code=401, detail="Invalid Authorization header. Expected 'Bearer <token>'")
    return value
