# nlite

React 19 framework tooling built on Vite and React Server Components.

`nlite` gives you file system routing, React Server Components, streaming SSR, static generation, API routes, client navigation helpers, and an optional Cloudflare adapter.

## Getting Started

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

Create your first route:

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

## Routes

`nlite` discovers routes from files inside `app`:

- `page.tsx` creates a page route.
- `layout.tsx` wraps routes below that segment.
- `loading.tsx` and `error.tsx` provide segment UI.
- `api/**/route.ts` creates API routes.
- `[id]` creates a dynamic segment.
- `[...slug]` creates a catch-all segment.

Dynamic route params are passed as promises:

```tsx
// app/users/[id]/page.tsx
export default async function UserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return <h1>User {id}</h1>;
}
```

Static pages are prerendered when possible. Use `export const rendering = "force-ssr"` only for routes that must render on request, and `generateStaticParams` for dynamic paths that should be generated at build time.

## API Routes

```ts
// app/api/status/route.ts
export function GET() {
  return Response.json({ ok: true });
}
```

## Client Navigation

```tsx
import Link from "nlite/link";

export function UserLink() {
  return <Link href="/users/1">User 1</Link>;
}
```

```tsx
"use client";

import { usePathname, useRouter } from "nlite/navigation";

export function CurrentRoute() {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <button type="button" onClick={() => router.refresh()}>
      Refresh {pathname}
    </button>
  );
}
```

## Configuration

`defineConfig` accepts Vite config plus an optional `nlite` field:

```ts
import { defineConfig } from "nlite/config";

export default defineConfig({
  nlite: {
    appDir: "src/app",
  },
});
```

## CLI

```bash
nlite dev       # development server
nlite build     # production build
nlite preview   # preview production output
```

## Cloudflare

For Cloudflare Workers builds, install the optional peer and enable the adapter.

```bash
pnpm add @cloudflare/vite-plugin
```

```ts
import { cloudflare } from "nlite/adapters";
import { defineConfig } from "nlite/config";

export default defineConfig({
  plugins: [cloudflare()],
});
```

## Examples

Working apps are in the [nlite examples](https://github.com/shamilkotta/nlite/tree/main/examples) directory:

## Status

`nlite` is experimental. APIs and conventions may change while the project develops.
