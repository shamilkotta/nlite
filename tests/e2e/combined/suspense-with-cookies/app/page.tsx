import { Suspense } from "react";
import { cookies } from "nlite/headers";

import { delay } from "../lib/delay";

export default function Page() {
  return (
    <main data-testid="page">
      <p data-testid="ppr-shell">ppr-shell</p>
      <Suspense fallback={<p data-testid="ppr-fallback">ppr-loading</p>}>
        <DynamicHole />
      </Suspense>
    </main>
  );
}

async function DynamicHole() {
  const cookieStore = await cookies();
  await delay(200);
  return <p data-testid="ppr-dynamic">dynamic:{cookieStore.get("visitor")?.value ?? "anon"}</p>;
}
