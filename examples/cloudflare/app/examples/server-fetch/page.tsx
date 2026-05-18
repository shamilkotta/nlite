import Link from "nlite/link";

import type { ServiceStatus, UserPublicRecord } from "../../../lib/server/app-data";
import { fetchApiJson } from "../../../lib/server/api-fetch";

export const rendering = "force-ssr";

export default async function Page() {
  const status = await fetchApiJson<ServiceStatus>("/api/status");
  const user = await fetchApiJson<UserPublicRecord>("/api/users/demo");

  return (
    <main className="main">
      <h1>Server Component → API routes</h1>
      <p className="muted">
        <code>force-ssr</code> page using <code>fetch(NLITE_ORIGIN + &quot;/api/…&quot;)</code>. Set env{" "}
        <code>NLITE_ORIGIN</code> (no trailing slash).
      </p>

      <h2 className="h2">GET /api/status</h2>
      <pre className="block">{JSON.stringify(status, null, 2)}</pre>

      <h2 className="h2">GET /api/users/demo</h2>
      <pre className="block">{JSON.stringify(user, null, 2)}</pre>

      <p>
        <Link href="/examples">← Examples</Link>
      </p>
    </main>
  );
}
