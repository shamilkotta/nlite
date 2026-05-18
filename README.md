# nlite

`nlite` is a small experimental React framework built on Vite and React Server Components.

This is a curiosity driven side project for learning how RSC, streaming SSR, static generation, file based routing, and deployment adapters can fit together on top of Vite.

## What It Does

- Uses React 19 and `@vitejs/plugin-rsc`.
- Provides file based routing from an `app` directory.
- Supports layouts, pages, loading UI, error UI, dynamic routes, and API routes.
- Includes streaming SSR and static generation experiments.
- Exposes a small CLI: `nlite dev`, `nlite build`, `nlite preview`, and `nlite start`.
- Includes a basic Cloudflare adapter experiment.

## What It Is Not

- Not stable.
- Not production ready.
- Not a Next.js replacement.
- Not guaranteed to keep the same APIs.
- Not thoroughly tested across every edge case.

Use it to read, experiment, break things, and understand the moving parts.

## Repo Layout

- `packages/nlite` - the framework package and CLI.
- `examples/*` - a minimal examples.

## Requirements

- Node.js compatible with Vite 8 and React 19.
- pnpm.

## Install

```bash
pnpm install
```

Build the package:

```bash
pnpm nlite build
```

## Run Examples

Basic example:

```bash
pnpm --filter example-basic dev
pnpm --filter example-basic build
pnpm --filter example-basic preview
```

Cloudflare example:

```bash
pnpm --filter example-cloudflare dev
pnpm --filter example-cloudflare build
pnpm --filter example-cloudflare preview
pnpm --filter example-cloudflare deploy
```

## Package Usage

Inside an app:

```bash
pnpm add nlite react react-dom
```

Add scripts:

```json
{
  "scripts": {
    "dev": "nlite dev",
    "build": "nlite build",
    "preview": "nlite preview"
  }
}
```

Create `nlite.config.ts`:

```ts
import { defineConfig } from "nlite/config";

export default defineConfig({});
```

Create routes inside `app`:

```txt
app/
  layout.tsx
  page.tsx
  api/status/route.ts
```

More package-level notes are in [`packages/nlite/README.md`](packages/nlite/README.md).

## Development

```bash
pnpm nlite dev          # watch package build
pnpm nlite build        # build package
pnpm lint               # oxlint
pnpm format             # oxfmt
pnpm test               # vitest
```

## License

MIT
