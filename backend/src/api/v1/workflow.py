from fastapi import APIRouter, Depends, HTTPException
from dependency.auth import validate_key

# Legacy header-key check. Kept for backward compatibility but the key is now
# read from the LEGACY_ACCESS_KEY env var (no hardcoded secret). If the env
# var is not set, the endpoint refuses all requests.
routers = APIRouter()


@routers.get("/auth")
def auth(access_key: str = Depends(validate_key)):
    return access_key
