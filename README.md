# nlite

**A React Server Components framework built on Vite.** File-based routing, streaming SSR, static generation, and Partial Prerendering (PPR) in a small, readable codebase, with adapters for Vercel, Cloudflare Workers, and Netlify.

[![npm version](https://img.shields.io/npm/v/nlite.svg)](https://www.npmjs.com/package/nlite)
[![license](https://img.shields.io/npm/l/nlite.svg)](LICENSE)
[![React 19](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev)
[![Vite 8](https://img.shields.io/badge/Vite-8-646cff.svg)](https://vite.dev)

```bash
pnpm add nlite react react-dom
```

> nlite is an experimental, learning-driven project. APIs may change between releases.

## What is nlite?

nlite is a React 19 meta-framework that uses [`@vitejs/plugin-rsc`](https://github.com/vitejs/vite-plugin-react/tree/main/packages/plugin-rsc) to bring an App Router–style developer experience to Vite. If you know Next.js's `app` directory, you already know how nlite works: `layout.tsx`, `page.tsx`, `loading.tsx`, `error.tsx`, and `route.ts`.

The goal is to show how React Server Components, streaming SSR, static generation, and Partial Prerendering fit together, in a codebase small enough to read in an afternoon.

## Features

- **React Server Components** on React 19 and Vite 8
- **File-based routing** from an `app` directory: nested layouts, dynamic `[id]` and catch-all `[...slug]` segments, route groups, and loading, error, and not-found UI
- **Streaming SSR** with Suspense
- **Static site generation (SSG)** with `generateStaticParams`
- **Partial Prerendering (PPR)**: a static shell with dynamic holes resumed at request time
- **`"use cache"`** for build-time cached server work
- **Route handlers** (`route.ts`) for API endpoints using standard `Request`/`Response`
- **Client navigation** with `Link`, prefetching, and `useRouter` / `usePathname` / `useSearchParams`
- **Metadata API** with `metadata` and `generateMetadata`
- **MDX content collections** with schema validation
- **Deployment adapters** for Vercel, Cloudflare Workers, and Netlify
- **Small CLI**: `nlite dev`, `build`, `preview`, `start`, and `deploy`

## Quick start

```ts
// nlite.config.ts
import { defineConfig } from "nlite/config";

export default defineConfig({ ppr: true });
```

```tsx
// app/layout.tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

```tsx
// app/page.tsx
import { Suspense } from "react";
import { cookies } from "nlite/headers";

export default function Page() {
  return (
    <main>
      <h1>Static shell, prerendered at build time</h1>
      <Suspense fallback={<p>Loading…</p>}>
        <Greeting />
      </Suspense>
    </main>
  );
}

async function Greeting() {
  const name = (await cookies()).get("name")?.value ?? "stranger";
  return <p>Hello, {name}. This part is rendered per request.</p>;
}
```

```bash
npx nlite dev
```

Full API reference: [`packages/nlite/README.md`](packages/nlite/README.md).

## Examples

| Example                                      | Shows                                  |
| -------------------------------------------- | -------------------------------------- |
| [`examples/basic`](examples/basic)           | Routing, layouts, MDX blog, API routes |
| [`examples/ppr`](examples/ppr)               | Partial Prerendering and `"use cache"` |
| [`examples/cloudflare`](examples/cloudflare) | Cloudflare Workers deployment          |
| [`examples/netlify`](examples/netlify)       | Netlify deployment                     |

```bash
pnpm install
pnpm --filter nlite build
pnpm --filter example-basic dev
```

## Repository layout

```txt
packages/nlite   framework package and CLI (published to npm as `nlite`)
examples/*       example apps
docs/            architecture notes and roadmap
tests/           integration tests
```

## Development

```bash
pnpm install
pnpm nlite dev      # watch-build the package
pnpm nlite build    # build the package
pnpm test           # vitest
pnpm lint           # oxlint
pnpm format         # oxfmt
```

Issues and pull requests are welcome. See the [Code of Conduct](CODE_OF_CONDUCT.md).

## License

[MIT](LICENSE) © [Shamil](https://github.com/shamilkotta)
