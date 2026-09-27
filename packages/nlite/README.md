# nlite

`nlite` is a React 19 framework on Vite for server-rendered apps with React Server Components, streaming SSR, static generation, and Partial Prerendering (PPR).

> `nlite` is experimental and not fully tested across edge cases. Public APIs may change between releases.

## Features

- App-directory routing with layouts, pages, loading UI, error UI, and not-found UI
- Static generation, request-time SSR, and PPR in the same route tree
- Route handlers for HTTP endpoints
- Request helpers for cookies, headers, redirects, and not-found responses
- Client navigation with `Link` and router hooks
- Deployment adapters for Vercel, Cloudflare Workers, and Netlify

## Requirements

- Node.js `^20.19.0` or `>=22.12.0`
- React and React DOM `^19.2.5`
- pnpm

## Quick Start

Install the package:

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
nlite preview   # serve the production build locally
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

Choose one deployment adapter in `nlite.config.ts`:

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
  plugins: [netlify()],
});
```

Build with the configured adapter:

```bash
pnpm nlite build
```

## Examples

Working examples are in [`examples`](https://github.com/shamilkotta/nlite/tree/main/examples):

- `examples/basic`
- `examples/ppr`
- `examples/cloudflare`

From a checkout:

```bash
pnpm install
pnpm --filter nlite build
pnpm --filter example-basic dev
```

## License

MIT
