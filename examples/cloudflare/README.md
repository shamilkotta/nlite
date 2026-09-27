Live: https://nlite-cf.shamilkotta.workers.dev

## Architecture

With `ppr: true` + `cloudflare()`:

1. **Eyeball** (entry, near the user) — assets + PPR shell stitching. Keeps your wrangler `name` (public URL).
2. **Origin** (`${name}-origin`, Smart Placement) — RSC/SSR resume. Your `wrangler.json(c)` is loaded here, so D1/KV/vars/bindings merge onto the Worker that runs app code.

Without `ppr`, a single Worker is built and your wrangler file is the entry config.

Deploy both when using PPR (see `pnpm deploy`).
