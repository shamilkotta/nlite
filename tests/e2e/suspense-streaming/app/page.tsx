import { Suspense } from "react";

import { delay } from "../lib/delay";

export const rendering = "force-ssr";

export default function Page() {
  return (
    <main data-testid="page">
      <p data-testid="suspense-shell">shell-ready</p>
      <Suspense fallback={<p data-testid="suspense-fallback">Loading slow…</p>}>
        <SlowMessage />
      </Suspense>
    </main>
  );
}

async function SlowMessage() {
  await delay(500);
  return <p data-testid="suspense-content">slow-content-ready</p>;
}
