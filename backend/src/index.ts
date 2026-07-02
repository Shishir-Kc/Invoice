import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env } from "./db/client";
import type { Vars } from "./lib/auth";
import { withDb } from "./lib/auth";
import { ApiError } from "./lib/errors";
import authApp from "./routes/auth";
import billsApp from "./routes/bills";
import membersApp from "./routes/members";
import notificationsApp from "./routes/notifications";
import settingsApp from "./routes/settings";
import workflowApp from "./routes/workflow";

const app = new Hono<{ Variables: Vars; Bindings: Env }>();

// ── CORS ────────────────────────────────────────────────────────────────────
// Frontend and backend are on different origins (different *.workers.dev
// subdomains during the temporary phase; different subdomains of
// shishirkhatri.com.np later). The browser enforces CORS on credentialed
// fetches even though the session cookie is sent same-site / cross-site, so
// we must explicitly allow the frontend origin(s) with credentials.
// A wildcard "*" is forbidden with credentials — list origins explicitly.
//
// Origins come from (in priority order):
//   1. CORS_ORIGINS env var (comma-separated) — set in wrangler.jsonc vars.
//   2. fallback: FRONTEND_URL + http://localhost:3000.
const allowedOrigins = (env: Env): string[] => {
  const raw = (env as Env & { CORS_ORIGINS?: string }).CORS_ORIGINS;
  const explicit = (raw ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (explicit.length) return explicit;
  const front = env.FRONTEND_URL ?? "http://localhost:3000";
  return [front, "http://localhost:3000"];
};

app.use(
  "*",
  cors({
    origin: (origin, c) => {
      const list = allowedOrigins(c.env as Env);
      return list.includes(origin ?? "") ? origin : null;
    },
    credentials: true,
    allowMethods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Authorization", "Content-Type", "Accept", "access-key"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// ── Security headers ────────────────────────────────────────────────────────
app.use("*", async (c, next) => {
  await next();
  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
  c.header("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
  c.header("Content-Security-Policy", "default-src 'self'; frame-ancestors 'none'");
});

// ── API routes (legacy prefix: /api/v1/invoicely) ───────────────────────────
const api = new Hono<{ Variables: Vars; Bindings: Env }>();
api.use("*", withDb);

api.route("/", workflowApp); // GET /auth (legacy header-key)
api.route("/auth", authApp);
api.route("/bills", billsApp);
api.route("/members", membersApp);
api.route("/notifications", notificationsApp);
api.route("/settings", settingsApp);

app.route("/api/v1/invoicely", api);

// ── Root health check ───────────────────────────────────────────────────────
app.get("/", (c) => c.json({ status: "yup running" }));

// ── Error handler: serialize as { detail } to match the legacy FastAPI shape ─
// The frontend reads `error.response.data.detail` everywhere; keep that intact.
app.onError((err, c) => {
  if (err instanceof ApiError) {
    return c.json({ detail: err.detail }, err.status as 400);
  }
  console.error("Unhandled error:", err);
  return c.json({ detail: "Internal server error" }, 500);
});

// ── 404 fallback ────────────────────────────────────────────────────────────
app.notFound((c) => c.json({ detail: "Not found" }, 404));

export default app;
