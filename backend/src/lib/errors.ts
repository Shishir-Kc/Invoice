/**
 * ApiError — the error type thrown across the app.
 *
 * The frontend reads `error.response.data.detail` (the shape FastAPI's
 * HTTPException produced: `{ "detail": <string|object> }`). Hono's built-in
 * HTTPException stringifies non-string messages, so we use our own class to
 * carry a structured `detail` (e.g. HYPER's `{ code, message, fields }`)
 * verbatim. The global error handler in index.ts serializes this as
 * `{ detail }`.
 */
export class ApiError extends Error {
  constructor(
    public status: number,
    public detail: unknown,
  ) {
    super(typeof detail === "string" ? detail : "API error");
    this.name = "ApiError";
  }
}
