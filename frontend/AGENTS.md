<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Build & Deploy

## Local dev
```bash
npm run dev
```

## Build
```bash
npm run build
```

## Cloudflare Pages deploy
```bash
npx opennextjs-cloudflare
npx wrangler pages deploy .vercel/output/static
```

## ENV
- `NEXT_PUBLIC_API_URL` — Backend API endpoint (default: `http://localhost:8000/api`)
