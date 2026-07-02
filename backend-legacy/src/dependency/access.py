"""Access-control helpers for official vs unofficial members."""

from datetime import datetime, timedelta, timezone
from typing import Tuple

from Schema.bill import User


def _as_aware_utc(dt: datetime) -> datetime:
    """Normalize a datetime to UTC-aware.

    Some DB drivers (notably SQLite) return naive datetimes even for
    ``TIMESTAMP WITH TIME ZONE`` columns. Comparing a naive value against
    ``datetime.now(timezone.utc)`` raises, so coerce naive values to UTC
    before comparing. Values that are already aware are returned unchanged.
    """
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


UNIT_SECONDS: dict[str, int] = {
    "hour": 3600,
    "day": 86400,
    "week": 7 * 86400,
    "year": 365 * 86400,
}

VALID_UNITS = set(UNIT_SECONDS.keys())


def duration_to_seconds(amount: int, unit: str) -> int:
    """Convert a (amount, unit) duration to seconds. Raises ValueError on bad unit."""
    if unit not in UNIT_SECONDS:
        raise ValueError(f"Invalid duration unit '{unit}'. Must be one of: {', '.join(sorted(VALID_UNITS))}")
    if amount <= 0:
        raise ValueError("Duration amount must be positive")
    return amount * UNIT_SECONDS[unit]


def duration_to_timedelta(amount: int, unit: str) -> timedelta:
    return timedelta(seconds=duration_to_seconds(amount, unit))


def is_official(user: User) -> bool:
    """Official members joined via HYPER (have a hyper_id). They are admins."""
    return bool(user.hyper_id)


def has_access(user: User) -> bool:
    """Whether a user may access Invoicely right now."""
    if is_official(user):
        return True
    if user.is_kicked:
        return False
    if user.access_expires_at is None:
        return True  # permanent unofficial
    return _as_aware_utc(user.access_expires_at) > datetime.now(timezone.utc)


def access_status(user: User) -> str:
    """Human-readable access status for display."""
    if is_official(user):
        return "official"
    if user.is_kicked:
        return "banned"
    if user.access_expires_at is None:
        return "permanent"
    if _as_aware_utc(user.access_expires_at) <= datetime.now(timezone.utc):
        return "expired"
    return "active"


def extend_expiry(user: User, amount: int, unit: str) -> datetime | None:
    """Return the new access_expires_at after extending by (amount, unit).

    If the current expiry is in the future, time is added on top of it.
    Otherwise the extension starts from now. Returns None for permanent
    (callers should use `permanent` endpoint for that, not this).
    """
    now = datetime.now(timezone.utc)
    current = user.access_expires_at
    base = current if (current and _as_aware_utc(current) > now) else now
    return base + duration_to_timedelta(amount, unit)
