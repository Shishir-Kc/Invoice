"""Lightweight in-process IP-based rate limiting for auth-sensitive endpoints.

This protects ``/auth/login``, ``/auth/login-unofficial`` and ``/members/join``
from brute-force / credential-stuffing attacks. It is intentionally simple
and dependency-free: a sliding-window counter keyed by client IP.

Caveats:
  - State lives in process memory. With multiple worker processes each has its
    own counter, so the effective limit is multiplied by the worker count.
    For a small internal app this is acceptable; for a larger deployment put a
    shared limiter (e.g. Redis-backed) or a reverse-proxy limiter in front.
  - The window/limit are conservative; tune via env vars if needed.
"""

from __future__ import annotations

import os
import time
from collections import defaultdict
from collections import deque
from typing import Deque, Dict

from fastapi import HTTPException, Request

# Limits (per IP). Override via env if necessary.
_LOGIN_LIMIT = int(os.getenv("RATELIMIT_LOGIN", "10"))  # attempts
_LOGIN_WINDOW = int(os.getenv("RATELIMIT_LOGIN_WINDOW", "60"))  # seconds
_JOIN_LIMIT = int(os.getenv("RATELIMIT_JOIN", "5"))
_JOIN_WINDOW = int(os.getenv("RATELIMIT_JOIN_WINDOW", "60"))


def _client_ip(request: Request) -> str:
    # Trust X-Forwarded-For only the first hop. Behind a reverse proxy that
    # sets this header, this is the real client IP. Otherwise fall back to the
    # direct peer.
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


class _WindowLimiter:
    def __init__(self, limit: int, window: int):
        self.limit = limit
        self.window = window
        self._hits: Dict[str, Deque[float]] = defaultdict(deque)

    def check(self, key: str) -> None:
        now = time.monotonic()
        dq = self._hits[key]
        # Evict entries outside the window.
        while dq and now - dq[0] > self.window:
            dq.popleft()
        if len(dq) >= self.limit:
            raise HTTPException(
                status_code=429,
                detail="Too many attempts. Please wait a minute and try again.",
            )
        dq.append(now)


_login_limiter = _WindowLimiter(_LOGIN_LIMIT, _LOGIN_WINDOW)
_join_limiter = _WindowLimiter(_JOIN_LIMIT, _JOIN_WINDOW)


def rate_limit_login(request: Request) -> None:
    _login_limiter.check(_client_ip(request))


def rate_limit_join(request: Request) -> None:
    _join_limiter.check(_client_ip(request))
