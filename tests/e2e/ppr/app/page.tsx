import { Suspense } from "react";
import { cookies } from "nlite/headers";

import { delay } from "../lib/delay";

export default function Page() {
  return (
    <main data-testid="page">
      <p data-testid="ppr-shell">ppr-shell</p>
      <Suspense fallback={<p data-testid="ppr-cached-fallback">ppr-cached-loading</p>}>
        <CachedShell />
      </Suspense>
      <Suspense fallback={<p data-testid="ppr-fallback">ppr-loading</p>}>
        <DynamicHole />
      </Suspense>
    </main>
  );
}

async function CachedShell() {
  "use cache";
  await delay(10);
  return <p data-testid="ppr-cached">cached-ok</p>;
}

async function DynamicHole() {
  const cookieStore = await cookies();
  await delay(50);
  return <p data-testid="ppr-dynamic">dynamic:{cookieStore.get("visitor")?.value ?? "anon"}</p>;
}
