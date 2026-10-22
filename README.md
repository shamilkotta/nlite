# nlite

**nlite is a lightweight React 19 framework on Vite with Next.js-style `app/` routing.** It gives you layouts, loading and error UI, route handlers, streaming SSR, static generation, and Partial Prerendering (PPR), with deployment adapters for Vercel, Cloudflare Workers, and Netlify.

[![npm version](https://img.shields.io/npm/v/nlite.svg)](https://www.npmjs.com/package/nlite)
[![license](https://img.shields.io/npm/l/nlite.svg)](LICENSE)
[![React 19](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev)
[![Vite 8](https://img.shields.io/badge/Vite-8-646cff.svg)](https://vite.dev)

Project page: https://shamilkotta.com/projects/nlite

> Status: experimental. It is usable for side projects and small sites, but APIs may change between releases.

## Who it's for

- You like the Next.js `app` directory conventions (`layout.tsx`, `page.tsx`, `loading.tsx`, `error.tsx`, `route.ts`) and want them on Vite.
- You want React Server Components, SSR, SSG, and PPR without a large framework, in a codebase small enough to read.
- You deploy to Vercel, Cloudflare Workers, or Netlify, or you only need a local Node preview.

It is a lite alternative for people who want Next.js conventions on Vite. It is not a drop-in replacement for Next.js: many Next.js APIs are missing (see [Status and limitations](#status-and-limitations)).

## Install

```bash
pnpm add nlite react react-dom
# or
npm i nlite react react-dom
```

Requirements: Node.js `^20.19.0` or `>=22.12.0`, React and React DOM `^19.2.5`.

## Quick start

Add scripts to `package.json`:

```json
{
  "scripts": {
    "dev": "nlite dev",
    "build": "nlite build",
    "preview": "nlite preview"
  }
}
```

Create `nlite.config.ts` (optional, nlite falls back to a default config):

```ts
import { defineConfig } from "nlite/config";

export default defineConfig({ ppr: true });
```

Create a root layout and a page:

```tsx
// app/layout.tsx
import type { ReactNode } from "react";

export default function RootLayout({ children }: { children: ReactNode }) {
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
      <Suspense fallback={<p>Loading...</p>}>
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

Run it:

```bash
pnpm dev
```

## Features

- **React Server Components** on React 19 and Vite 8, through [`@vitejs/plugin-rsc`](https://github.com/vitejs/vite-plugin-react/tree/main/packages/plugin-rsc)
- **File-based routing** from `app/`: nested layouts, `loading.tsx`, `error.tsx`, `not-found.tsx`, dynamic `[id]` and catch-all `[...slug]` segments, and `(group)` route groups
- **Route handlers** in `route.ts` with standard `Request` and `Response` (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS`)
- **Streaming SSR** with Suspense
- **Static site generation** with `generateStaticParams`, plus `export const rendering = "force-ssr" | "force-ssg"` per route
- **Partial Prerendering**: a static shell with dynamic holes resumed at request time (`ppr: true`)
- **`"use cache"`** for server work that runs at build time and ships with the static shell
- **Request helpers**: `cookies()` and `headers()` from `nlite/headers`, `redirect()` and `notFound()` from `nlite/navigation`
- **Client navigation**: `Link` with prefetch (`true`, `false`, or `"hover"`), plus `useRouter`, `usePathname`, and `useSearchParams`
- **Metadata API**: `metadata` and `generateMetadata` exports
- **MDX content collections** with schema validation (`nlite/mdx`)
- **Deployment adapters** for Vercel, Cloudflare Workers, and Netlify (`nlite/adapters`)
- **CLI**: `nlite dev`, `nlite build`, `nlite preview`, and `nlite start` (alias for `preview`)

## How it compares to Next.js

nlite borrows the Next.js App Router file conventions, so the mental model carries over. The differences:

|                                         | nlite                                                      | Next.js                                                                       |
| --------------------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Build tool                              | Vite 8 and its plugin ecosystem                            | Next.js compiler (Turbopack or webpack)                                       |
| Routing                                 | `app/` with layout, page, loading, error, not-found, route | Same conventions, plus parallel and intercepting routes, `template`, and more |
| Rendering                               | SSR, SSG, PPR, `"use cache"`                               | SSR, SSG, ISR, PPR, caching and revalidation APIs                             |
| Server Actions                          | Not exposed by the framework yet                           | Supported                                                                     |
| Middleware, image and font optimization | Not included                                               | Included                                                                      |
| Deploy                                  | Adapters for Vercel, Cloudflare, Netlify                   | Vercel and self-hosting, plus community adapters                              |
| Size                                    | Small codebase you can read in an afternoon                | Large, production-hardened framework                                          |

Pick nlite if you want Vite and the `app/` conventions for a side project or a small site and are fine with an experimental framework. Pick Next.js if you need its full API surface or production guarantees.

## Deploy

`nlite build` writes to `.nlite`, and `nlite start` serves the output. Add an adapter in `nlite.config.ts` to build for a platform instead.

```ts
import { defineConfig } from "nlite/config";
import { vercel } from "nlite/adapters"; // or cloudflare, netlify

export default defineConfig({
  ppr: true,
  plugins: [vercel()],
});
```

| Adapter        | Output              | Deploy                      |
| -------------- | ------------------- | --------------------------- |
| `vercel()`     | `.nlite`,`.vercel`  | `vercel deploy --prebuilt`  |
| `cloudflare()` | `.nlite`            | `wrangler deploy`           |
| `netlify()`    | `.nlite`,`.netlify` | `netlify deploy --prebuilt` |
|                | `.nlite`            | `nlite start`               |

`cloudflare()` needs `@cloudflare/vite-plugin` package to be installed.

## Status and limitations

- Experimental. Public APIs can change between minor releases.
- Server Actions (`"use server"`) are not wired up at the framework level yet.
- No middleware, image optimization, or font optimization.
- No ISR or on-demand revalidation. `"use cache"` caches at build time.

## Documentation

Full API reference: [`packages/nlite/README.md`](packages/nlite/README.md). A summary for LLMs and tools is in [`llms.txt`](llms.txt).

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

[MIT](LICENSE) © [shamil](https://github.com/shamilkotta)
