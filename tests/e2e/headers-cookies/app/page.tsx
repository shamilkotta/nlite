import { cookies, headers } from "nlite/headers";

import { getRenderTimestamp } from "../lib/timestamp";

export default async function Page({ searchParams }: { searchParams: Promise<URLSearchParams> }) {
  const [qs, requestHeaders, cookieStore] = await Promise.all([searchParams, headers(), cookies()]);

  return (
    <main data-testid="page">
      <p data-testid="render-mode">request-apis</p>
      <p data-testid="rendered-at">{getRenderTimestamp()}</p>
      <p data-testid="query-ref">{qs.get("ref") ?? "none"}</p>
      <p data-testid="cookie-theme">{cookieStore.get("theme")?.value ?? "none"}</p>
      <p data-testid="header-x-test">{requestHeaders.get("x-test") ?? "none"}</p>
    </main>
  );
}
