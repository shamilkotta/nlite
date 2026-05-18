import Link from "nlite/link";

import { getServiceStatus } from "@/lib/server/app-data";

export default async function Page() {
  const status = getServiceStatus();

  return (
    <main className="main">
      <h1>Home</h1>
      <p className="muted">
        Server Component reading shared server modules (same data as GET /api/status).
      </p>
      <pre className="block">{JSON.stringify(status, null, 2)}</pre>

      <h2 className="h2">Rendering</h2>
      <ul className="link-list">
        <li>
          <Link href="/examples/auto">Auto SSG</Link>
          <span className="muted"> — no export; prerender when static</span>
        </li>
        <li>
          <Link href="/examples/force-ssg">force-ssg</Link>
          <span className="muted"> — always static at build</span>
        </li>
        <li>
          <Link href="/examples/force-ssr">force-ssr</Link>
          <span className="muted"> — always request-time</span>
        </li>
        <li>
          <Link href="/examples/ssg/alpha">SSG + params</Link>
          <span className="muted"> — generateStaticParams</span>
        </li>
        <li>
          <Link href="/users/alice">SSR dynamic</Link>
          <span className="muted"> — /users/[id], no static params</span>
        </li>
      </ul>

      <h2 className="h2">Server Component → API</h2>
      <ul className="link-list">
        <li>
          <Link href="/examples/server-fetch">server-fetch</Link>
          <span className="muted"> — force-ssr; fetch /api/* (needs NLITE_ORIGIN)</span>
        </li>
        <li>
          <a href="/api/status">GET /api/status</a>
          <span className="muted"> — raw JSON</span>
        </li>
      </ul>
    </main>
  );
}
