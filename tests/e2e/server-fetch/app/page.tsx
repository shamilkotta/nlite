import { headers } from "nlite/headers";

import { getRenderTimestamp } from "../lib/timestamp";

export default async function Page() {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host");
  if (!host) throw new Error("Missing Host header");

  const response = await fetch(`http://${host}/api/status`, { cache: "no-store" });
  const status = (await response.json()) as { ok: boolean; ts: string };

  return (
    <main data-testid="page">
      <p data-testid="render-mode">fetch-ssr</p>
      <p data-testid="rendered-at">{getRenderTimestamp()}</p>
      <pre data-testid="status-json">{JSON.stringify(status)}</pre>
    </main>
  );
}
