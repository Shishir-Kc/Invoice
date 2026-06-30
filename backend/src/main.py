import os

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

from api import router

server = FastAPI()

# CORS: origins are env-driven (comma-separated). Defaults to the local
# dev frontend only. With ``allow_credentials=True`` the spec forbids a
# wildcard origin, so each allowed origin must be listed explicitly. Set
# CORS_ORIGINS to your real frontend domain(s) in production.
_cors_raw = os.getenv("CORS_ORIGINS", "http://localhost:3000")
_allowed_origins = [o.strip() for o in _cors_raw.split(",") if o.strip()]
if not _allowed_origins:
    raise RuntimeError(
        "CORS_ORIGINS is empty. Set it to your frontend origin(s), e.g. "
        "https://invoicely.pages.dev"
    )

server.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
    expose_headers=["Content-Length"],
)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add baseline browser security headers to every response."""

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        response.headers.setdefault(
            "Permissions-Policy",
            "geolocation=(), microphone=(), camera=()",
        )
        # A conservative default CSP; API responses aren't HTML but this
        # protects any HTML/error pages FastAPI renders.
        response.headers.setdefault(
            "Content-Security-Policy",
            "default-src 'self'; frame-ancestors 'none'",
        )
        return response


server.add_middleware(SecurityHeadersMiddleware)


@server.get("/")
def root():
    return {"status": "yup running"}


server.include_router(router, prefix="/api/v1")
