"""Legacy access-key dependency.

Used by the old ``GET /auth`` route. The key is read from the
``LEGACY_ACCESS_KEY`` environment variable — there is no hardcoded secret. If
the variable is unset, every request is rejected (fail-closed).
"""

import os

from fastapi import HTTPException, Header


def validate_key(access_key: str = Header(..., alias="access-key")) -> str:
    expected = os.getenv("LEGACY_ACCESS_KEY")
    if not expected:
        # No key configured → endpoint is disabled.
        raise HTTPException(status_code=503, detail="Legacy auth endpoint is disabled")
    if access_key != expected:
        raise HTTPException(status_code=401, detail="Invalid access key")
    return access_key
