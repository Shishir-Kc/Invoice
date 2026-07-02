import { ApiError } from "./errors";
import type { Env } from "../db/client";

export interface HyperUser {
  id: string;
  email: string;
  name: string;
  accountType: string;
}

/**
 * HYPER (Arcademia) auth integration.
 *
 * Proxies login to the external HYPER API. The Worker NEVER trusts a JWT
 * presented by the client. On a successful HYPER login we mint our own opaque
 * session token (see routes/auth.ts + the `sessions` table) and return that to
 * the frontend. The HYPER access token is used only here, in this trusted
 * server-to-HYPER call, and is then discarded — it is never sent to the
 * client, so it cannot be forged or stolen and replayed against us.
 */

export async function loginWithHyper(env: Env, email: string, password: string): Promise<HyperUser> {
  const base = env.HYPER_API_URL ?? "https://api.arcademia.app";
  let resp: Response;
  try {
    resp = await fetch(`${base}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new ApiError(502, {
      code: "hyper_unreachable",
      message: "Could not reach the HYPER auth service. Please try again.",
      fields: {},
    });
  }

  if (!resp.ok) throw new ApiError(resp.status, await parseHyperError(resp));

  let body: any;
  try {
    body = await resp.json();
  } catch {
    throw new ApiError(502, { code: "hyper_error", message: "Login failed.", fields: {} });
  }

  const token: string | undefined = body?.accessToken;
  if (!token) {
    throw new ApiError(502, {
      code: "hyper_error",
      message: "HYPER did not return an access token.",
      fields: {},
    });
  }

  const u = body?.user ?? {};
  return {
    id: u.id ?? "",
    email: u.email ?? "",
    name: (u.username ?? u.email ?? "").trim(),
    accountType: u.accountType ?? u.account_type ?? "",
  };
}

interface HyperErrorDetail {
  code: string;
  message: string;
  fields: Record<string, string>;
}

/** Map HYPER's error response into a structured detail object the frontend
 *  already understands (it reads `error.response.data.detail`). */
async function parseHyperError(resp: Response): Promise<HyperErrorDetail> {
  let code = "hyper_error";
  const fields: Record<string, string> = {};
  let message = "Login failed.";

  try {
    const body = (await resp.json()) as any;
    const errors = body?.errors;
    if (errors && typeof errors === "object") {
      for (const [field, msgs] of Object.entries(errors as Record<string, unknown>)) {
        if (Array.isArray(msgs) && msgs.length) fields[field] = String(msgs[0]);
        else if (typeof msgs === "string") fields[field] = msgs;
      }
      if (fields.email) {
        code = "invalid_email";
        message = fields.email;
      } else if (fields.password) {
        code = "password_required";
        message = fields.password;
      } else if (fields.general) {
        code = "invalid_credentials";
        message = fields.general;
      } else if (Object.keys(fields).length) {
        code = "hyper_error";
        message = Object.values(fields)[0] as string;
      }
    } else if (body?.message) {
      message = String(body.message);
    }
  } catch {
    /* keep defaults */
  }
  return { code, message, fields };
}
