import { ApiError } from "../lib/errors";
import { Hono } from "hono";
import type { Env } from "../db/client";

// Legacy header-key auth. Kept for backward compatibility. The key is read
// from the LEGACY_ACCESS_KEY secret (no hardcoded secret). If unset, every
// request is rejected (fail-closed).
const app = new Hono<{ Bindings: Env }>();

app.get("/auth", (c) => {
  const expected = c.env.LEGACY_ACCESS_KEY;
  if (!expected) throw new ApiError(503, "Legacy auth endpoint is disabled");
  const provided = c.req.header("access-key");
  if (provided !== expected) throw new ApiError(401, "Invalid access key");
  return c.json({ success: true, data: { accessKey: provided }, message: "ok" });
});

export default app;
