import { cookies, headers } from "nlite/headers";

import { getRenderTimestamp } from "../../../lib/timestamp";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, cookieStore, requestHeaders] = await Promise.all([params, cookies(), headers()]);
  return (
    <main data-testid="page">
      <p data-testid="user-id">{id}</p>
      <p data-testid="theme">{cookieStore.get("theme")?.value ?? "light"}</p>
      <p data-testid="visitor">{cookieStore.get("visitor")?.value ?? "none"}</p>
      <p data-testid="accept-language">
        {requestHeaders.get("accept-language")?.split(",")[0]?.trim() ?? "unknown"}
      </p>
      <p data-testid="rendered-at">{getRenderTimestamp()}</p>
    </main>
  );
}
