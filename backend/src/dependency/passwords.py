"""Password hashing for unofficial (invite-joined) members.

Official members authenticate via HYPER and never set a local password.
Unofficial members set a password when they accept an invite and use it to
log back in via the dedicated unofficial login endpoint.

Uses stdlib ``hashlib.scrypt`` (memory-hard, no third-party dependency).
Hashes are stored as ``scrypt$<n>$<r>$<p>$<salt-hex>$<hash-hex>`` so params +
salt travel with the hash (verifiable & upgradable).
"""

from __future__ import annotations

import hashlib
import secrets
from typing import Tuple

# Scrypt cost parameters. N must be a power of two. These give a reasonably
# strong work factor for a low-volume internal app without being too slow.
_N = 1 << 15  # 32768
_R = 8
_P = 1
_DKEYLEN = 32
_MAXMEM = 128 * 1024 * 1024  # 128 MB headroom for scrypt's memory cost

_PREFIX = "scrypt"


def hash_password(plain: str) -> str:
    """Return a self-describing scrypt hash string for the given password."""
    salt = secrets.token_bytes(16)
    dk = hashlib.scrypt(
        plain.encode("utf-8"),
        salt=salt,
        n=_N,
        r=_R,
        p=_P,
        dklen=_DKEYLEN,
        maxmem=_MAXMEM,
    )
    return (
        f"{_PREFIX}${_N}${_R}${_P}${salt.hex()}${dk.hex()}"
    )


def _parse(stored: str) -> Tuple[int, int, int, bytes, bytes]:
    parts = stored.split("$")
    if len(parts) != 6 or parts[0] != _PREFIX:
        raise ValueError("Unrecognized password hash format")
    n, r, p = int(parts[1]), int(parts[2]), int(parts[3])
    salt = bytes.fromhex(parts[4])
    expected = bytes.fromhex(parts[5])
    return n, r, p, salt, expected


def verify_password(plain: str, stored: str) -> bool:
    """Constant-time-ish verification of a password against a stored hash."""
    try:
        n, r, p, salt, expected = _parse(stored)
    except ValueError:
        return False
    dk = hashlib.scrypt(
        plain.encode("utf-8"),
        salt=salt,
        n=n,
        r=r,
        p=p,
        dklen=len(expected),
        maxmem=_MAXMEM,
    )
    return secrets.compare_digest(dk, expected)
