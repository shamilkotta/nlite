import { cookies, headers } from "nlite/headers";

import { getRenderTimestamp } from "../../lib/timestamp";

export const rendering = "force-ssg";

export default async function Page({ searchParams }: { searchParams: Promise<URLSearchParams> }) {
  const [qs, , cookieStore] = await Promise.all([searchParams, headers(), cookies()]);
  return (
    <main data-testid="force-ssg-page">
      <p data-testid="render-mode">force-ssg</p>
      <p data-testid="rendered-at">{getRenderTimestamp()}</p>
      <p data-testid="ref">{qs.get("ref") ?? "none"}</p>
      <p data-testid="theme">{cookieStore.get("theme")?.value ?? "none"}</p>
    </main>
  );
}
