import { scryptSync, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Password hashing for unofficial (invite-joined) members.
 *
 * Officials authenticate via HYPER and never set a local password. Unofficial
 * members set a password when they accept an invite and use it to log back in
 * via /auth/login-unofficial.
 *
 * Uses scrypt via `node:crypto` (available in the Workers runtime under the
 * `nodejs_compat` flag). Hashes are stored as
 *   scrypt$<N>$<r>$<p>$<salt-hex>$<hash-hex>
 * so params + salt travel with the hash (verifiable & upgradable). This is the
 * SAME format the legacy Python backend used, so existing unofficial-user
 * hashes migrate to D1 unchanged and still verify here.
 */

const PREFIX = "scrypt";
const N = 1 << 15; // 32768
const R = 8;
const P = 1;
const DKLEN = 32;
const MAXMEM = 128 * 1024 * 1024; // 128 MB headroom for scrypt's memory cost

export function hashPassword(plain: string): string {
  const salt = randomBytes(16);
  const dk = scryptSync(plain, salt, DKLEN, { N, r: R, p: P, maxmem: MAXMEM });
  return `${PREFIX}$${N}$${R}$${P}$${salt.toString("hex")}$${dk.toString("hex")}`;
}

function parse(stored: string): { n: number; r: number; p: number; salt: Buffer; expected: Buffer } {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== PREFIX) throw new Error("Unrecognized password hash format");
  const saltHex = parts[4]!;
  const hashHex = parts[5]!;
  return {
    n: Number(parts[1]),
    r: Number(parts[2]),
    p: Number(parts[3]),
    salt: Buffer.from(saltHex, "hex"),
    expected: Buffer.from(hashHex, "hex"),
  };
}

/** Verify a password against a stored scrypt hash (constant-time compare). */
export function verifyPassword(plain: string, stored: string): boolean {
  try {
    const { n, r, p, salt, expected } = parse(stored);
    const dk = scryptSync(plain, salt, expected.length, { N: n, r, p, maxmem: MAXMEM });
    return dk.length === expected.length && timingSafeEqual(dk, expected);
  } catch {
    return false;
  }
}

/** A well-formed dummy hash used to keep verify timing roughly constant when
 *  an account doesn't exist (avoids user enumeration via timing). */
export const DUMMY_HASH =
  "scrypt$32768$8$1$00000000000000000000000000000000$" +
  "0000000000000000000000000000000000000000000000000000000000000000";
