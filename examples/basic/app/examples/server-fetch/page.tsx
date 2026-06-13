import Link from "nlite/link";

import { RenderProbe } from "@/components/render-probe";
import type { ServiceStatus, UserPublicRecord } from "@/lib/server/app-data";
import { fetchApiJson } from "@/lib/server/api-fetch";
import { getRenderTimestamp } from "@/lib/server/render-proof";

export default async function Page() {
  const renderedAt = getRenderTimestamp();
  const pageFetchStartedAt = getRenderTimestamp();

  const status = await fetchApiJson<ServiceStatus>("/status");
  const user = await fetchApiJson<UserPublicRecord>("/api/users/demo");
  const pageFetchFinishedAt = getRenderTimestamp();

  return (
    <main className="main">
      <h1>fetch() → auto SSR</h1>
      <p className="muted">
        No <code>rendering</code> export. Uncached <code>fetch()</code> marks this route dynamic, so
        nlite renders on each request. Set <code>NLITE_ORIGIN</code> for API calls.
      </p>

      <pre className="block">
        {JSON.stringify(
          {
            signal: "fetch (cache: no-store)",
            renderedAt,
            pageFetchStartedAt,
            pageFetchFinishedAt,
          },
          null,
          2,
        )}
      </pre>

      <h2 className="h2">GET /api/status</h2>
      <pre className="block">{JSON.stringify(status, null, 2)}</pre>

      <h2 className="h2">GET /api/users/demo</h2>
      <pre className="block">{JSON.stringify(user, null, 2)}</pre>

      <RenderProbe serverRenderedAt={renderedAt} expected="live" />

      <p>
        <Link href="/examples">← Examples</Link>
      </p>
    </main>
  );
}
