# nlite

**nlite is a lightweight React 19 framework on Vite with Next.js-style `app/` routing.** It gives you layouts, loading and error UI, route handlers, streaming SSR, static site generation, and Partial Prerendering (PPR) on React 19 and Vite 8, with deployment adapters for Vercel, Cloudflare Workers, and Netlify.

[![npm version](https://img.shields.io/npm/v/nlite.svg)](https://www.npmjs.com/package/nlite)
[![license](https://img.shields.io/npm/l/nlite.svg)](https://github.com/shamilkotta/nlite/blob/main/LICENSE)
[![GitHub](https://img.shields.io/badge/GitHub-shamilkotta%2Fnlite-181717.svg?logo=github)](https://github.com/shamilkotta/nlite)

> nlite is experimental. It is usable for side projects and small sites, but public APIs may change between releases.

Project page: https://shamilkotta.com/projects/nlite

**Who it's for:** people who like the Next.js `app` directory conventions and want them on Vite, with React Server Components, SSR, SSG, and PPR in a small codebase. It is a lite alternative, not a drop-in replacement for Next.js. See [FAQ](#faq) and [Limitations](#limitations).

## Features

- App-directory routing with layouts, pages, loading UI, error UI, and not-found UI
- Static generation, request-time SSR, and PPR in the same route tree
- `"use cache"` for build-time cached server work
- Route handlers for HTTP endpoints
- Request helpers for cookies, headers, redirects, and not-found responses
- Client navigation with `Link` and router hooks
- Metadata API and MDX content collections
- Deployment adapters for Vercel, Cloudflare Workers, and Netlify

## Contents

- [Quick Start](#quick-start)
- [CLI](#cli)
- [Routing](#routing)
- [Rendering](#rendering)
- [Partial Prerendering](#partial-prerendering)
- [Route Handlers](#route-handlers)
- [Request Data](#request-data)
- [Navigation](#navigation)
- [Metadata](#metadata)
- [MDX Content](#mdx-content)
- [Configuration](#configuration)
- [Deployment](#deployment)
- [Examples](#examples)
- [Limitations](#limitations)

## Requirements

- Node.js `^20.19.0` or `>=22.12.0`
- React and React DOM `^19.2.5`
- pnpm

## Quick Start

Install the package:

```bash
pnpm add nlite react react-dom
# or
npm i nlite react react-dom
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

Create the first route:

```txt
app/
  layout.tsx
  page.tsx
```

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
export default function HomePage() {
  return <h1>Hello from nlite</h1>;
}
```

Run the dev server:

```bash
pnpm dev
```

## CLI

```bash
nlite dev       # start the development server
nlite build     # create a production build in .nlite
nlite preview   # serve the production build
nlite start     # alias for preview
```

## Routing

Routes are discovered from the `app` directory.

| File            | Purpose                                        |
| --------------- | ---------------------------------------------- |
| `layout.tsx`    | Wraps pages and nested layouts below a segment |
| `page.tsx`      | Renders a page for the segment                 |
| `loading.tsx`   | Suspense fallback for the segment              |
| `error.tsx`     | Error UI for the segment                       |
| `not-found.tsx` | Not-found UI for the segment                   |
| `route.ts`      | HTTP route handler for the segment             |

Path conventions:

- `[id]` creates a dynamic segment. `params.id` is a `string`.
- `[...slug]` creates a catch-all segment. `params.slug` is a `string[]`.
- `(group)` creates a route group that does not appear in the URL.

`params` and `searchParams` are promises:

```tsx
// app/users/[id]/page.tsx
export default async function UserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <h1>User {id}</h1>;
}
```

A segment can use either `page.tsx` or `route.ts`, not both.

## Rendering

`nlite build` prerenders routes when it can complete them without request data.

- Static routes are prerendered by default.
- Dynamic routes are prerendered for paths returned by `generateStaticParams`.
- Routes that read request data render on demand, unless PPR is enabled.

```tsx
// app/posts/[slug]/page.tsx
export async function generateStaticParams() {
  return [{ slug: "hello" }, { slug: "intro" }];
}

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <h1>{slug}</h1>;
}
```

Use `rendering` when a route needs an explicit mode:

```ts
export const rendering = "force-ssr";
```

- `force-ssr` renders on every request.
- `force-ssg` requires the route to be fully static. Dynamic `force-ssg` routes must export `generateStaticParams`.

## Partial Prerendering

PPR lets a route ship a static shell while deferring request-bound work to runtime. Enable it in `nlite.config.ts`:

```ts
import { defineConfig } from "nlite/config";

export default defineConfig({
  ppr: true,
});
```

Place request-bound UI behind a Suspense boundary. The fallback becomes part of the static shell, and the dynamic content is resumed and streamed when the request arrives.

```tsx
import { Suspense } from "react";
import { cookies } from "nlite/headers";

export default function Page() {
  return (
    <main>
      <h1>Store</h1>
      <Suspense fallback={<p>Loading cart...</p>}>
        <Cart />
      </Suspense>
    </main>
  );
}

async function Cart() {
  const cookieStore = await cookies();
  const cartId = cookieStore.get("cart")?.value ?? "empty";
  return <p>Cart {cartId}</p>;
}
```

These operations make the current boundary request-bound:

- `cookies()` and `headers()` from `nlite/headers`
- awaiting `searchParams`
- `fetch()` without a build-time cache mode

Use `"use cache"` for work that should run during prerender and be stored with the shell:

```tsx
async function ProductList() {
  "use cache";

  const response = await fetch("https://example.com/products", {
    cache: "force-cache",
  });
  const products = await response.json();

  return (
    <ul>
      {products.map((product: { id: string; name: string }) => (
        <li key={product.id}>{product.name}</li>
      ))}
    </ul>
  );
}
```

## Route Handlers

A `route.ts` file exports HTTP method functions:

```ts
// app/api/status/route.ts
export function GET() {
  return Response.json({ ok: true });
}
```

Supported methods are `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, and `OPTIONS`.

```ts
// app/api/users/[id]/route.ts
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return Response.json({ id });
}
```

## Request Data

Read cookies and headers from server code with `nlite/headers`:

```tsx
import { cookies, headers } from "nlite/headers";

export default async function Page() {
  const headerStore = await headers();
  const cookieStore = await cookies();

  return (
    <p>
      {headerStore.get("x-country")} {cookieStore.get("session")?.value}
    </p>
  );
}
```

Both helpers are async. `cookies()` supports `get`, `getAll`, and `has`.

## Navigation

Use `Link` for client-side transitions:

```tsx
import Link from "nlite/link";

export function UserLink() {
  return (
    <Link href="/users/1" prefetch="hover">
      User 1
    </Link>
  );
}
```

`prefetch` accepts `true`, `false`, or `"hover"`.

Client hooks are available from `nlite/navigation`:

```tsx
"use client";

import { usePathname, useRouter, useSearchParams } from "nlite/navigation";

export function CurrentRoute() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <button type="button" onClick={() => router.refresh()}>
      Refresh {pathname}?q={searchParams.get("q")}
    </button>
  );
}
```

`useRouter()` returns `push`, `replace`, `back`, `forward`, `refresh`, and `prefetch`.

Server navigation helpers are exported from the same module:

```tsx
import { notFound, redirect } from "nlite/navigation";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (id === "new") redirect("/users");
  if (id === "0") notFound();

  return <h1>{id}</h1>;
}
```

## Metadata

Pages and layouts can export static metadata or generate it dynamically:

```tsx
import type { Metadata } from "nlite";

export const metadata: Metadata = {
  title: "Home",
  description: "A page rendered with nlite",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return { title: `User ${id}` };
}
```

## MDX Content

Load Markdown and MDX files as typed content collections. Install the optional peers first:

```bash
pnpm add -D @mdx-js/rollup gray-matter
```

```ts
// nlite.config.ts
import { defineConfig } from "nlite/config";
import { defineCollection, mdx } from "nlite/mdx";
import { z } from "zod";

export default defineConfig({
  plugins: [
    mdx({
      collections: {
        blog: defineCollection({
          source: "content/blog/**/*.{md,mdx}",
          schema: z.object({ title: z.string(), publishedAt: z.coerce.date() }),
        }),
      },
    }),
  ],
});
```

Read entries from server components with `getCollection(name)` and `getEntry(name, slug)` from `nlite/mdx`.

## Configuration

`defineConfig` accepts framework options, deploy/build plugins, and Vite config.

```ts
import { defineConfig } from "nlite/config";

export default defineConfig({
  appDir: "src/app",
  ppr: true,
  staleTimes: {
    static: 600,
    dynamic: 0,
  },
  vite: {
    resolve: {
      alias: { "@": new URL(".", import.meta.url).pathname },
    },
  },
});
```

| Option               | Default | Description                                               |
| -------------------- | ------- | --------------------------------------------------------- |
| `appDir`             | `"app"` | Directory scanned for routes                              |
| `ppr`                | `false` | Prerender static shells and resume dynamic holes          |
| `staleTimes.static`  | `300`   | Stale time, in seconds, for static responses              |
| `staleTimes.dynamic` | `0`     | Stale time, in seconds, for dynamic and resumed responses |

Production builds write to `.nlite`. Public environment variables must use the `NLITE_PUBLIC_` prefix.

## Deployment

`nlite build` writes to `.nlite`, and `nlite start` serves the output. Add an adapter in `nlite.config.ts` to build for a platform instead:

```ts
import { cloudflare, netlify, vercel } from "nlite/adapters";
import { defineConfig } from "nlite/config";

// Vercel: pnpm add -D vercel
export default defineConfig({
  ppr: true,
  plugins: [vercel()],
});

// Cloudflare: pnpm add -D @cloudflare/vite-plugin wrangler
export default defineConfig({
  ppr: true,
  plugins: [cloudflare()],
});

// Netlify: pnpm add -D netlify
export default defineConfig({
  ppr: true,
  plugins: [netlify()],
});
```

Build with the configured adapter, then deploy the output with the platform CLI:

```bash
pnpm nlite build
```

| Adapter        | Output              |
| -------------- | ------------------- |
| `vercel()`     | `.nlite`,`.vercel`  |
| `cloudflare()` | `.nlite`,           |
| `netlify()`    | `.nlite`,`.netlify` |
|                | `.nlite`            |

## Examples

Working examples are in [`examples`](https://github.com/shamilkotta/nlite/tree/main/examples):

- `examples/basic`
- `examples/ppr`
- `examples/cloudflare`
- `examples/netlify`

From a checkout:

```bash
pnpm install
pnpm --filter nlite build
pnpm --filter example-basic dev
```

## Limitations

- Experimental. Public APIs can change between minor releases.
- Server Actions (`"use server"`) are not wired up at the framework level yet.
- No middleware, image optimization, or font optimization.
- No ISR or on-demand revalidation. `"use cache"` caches at build time.

## Links

- [Project page](https://shamilkotta.com/projects/nlite)
- [GitHub repository](https://github.com/shamilkotta/nlite)
- [Issues](https://github.com/shamilkotta/nlite/issues)

## License

MIT
