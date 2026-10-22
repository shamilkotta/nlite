import { Suspense } from "react";
import { headers } from "nlite/headers";

async function Failing() {
  await headers();
  await new Promise((resolve) => setTimeout(resolve, 20));
  throw new Error("failure inside suspense");
}

export default function Page() {
  return (
    <main>
      <h1 id="suspended-shell">Shell renders</h1>
      <Suspense fallback={<p id="fallback">Loading</p>}>
        <Failing />
      </Suspense>
    </main>
  );
}
