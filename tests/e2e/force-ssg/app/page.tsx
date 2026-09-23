import { cookies, headers } from "nlite/headers";

import { getRenderTimestamp } from "../lib/timestamp";

export const rendering = "force-ssg";

export default async function Page({ searchParams }: { searchParams: Promise<URLSearchParams> }) {
  const [qs, requestHeaders, cookieStore] = await Promise.all([searchParams, headers(), cookies()]);

  return (
    <main data-testid="page">
      <p data-testid="render-mode">force-ssg</p>
      <p data-testid="rendered-at">{getRenderTimestamp()}</p>
      <pre data-testid="request-snapshot">
        {JSON.stringify({
          ref: qs.get("ref"),
          theme: cookieStore.get("theme")?.value ?? null,
          accept: requestHeaders.get("accept"),
        })}
      </pre>
    </main>
  );
}
