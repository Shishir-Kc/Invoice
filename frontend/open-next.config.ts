import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// OpenNext Cloudflare adapter config. Required by `opennextjs-cloudflare build`.
// This replaces the deprecated @cloudflare/next-on-pages adapter, which
// required every dynamic route to export `runtime = 'edge'`. The OpenNext
// adapter runs the Next.js server (Node.js runtime) on Cloudflare's workerd,
// so no per-route edge-runtime config is needed.
export default defineCloudflareConfig();
