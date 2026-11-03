import { Suspense } from "react";

import { SlowUser } from "../../components/slow-user";

export default function Page() {
  return (
    <main>
      <h1 id="ppr-shell">PPR shell</h1>
      <Suspense fallback={<p id="ppr-fallback">Loading user</p>}>
        <SlowUser id="ppr-user" />
      </Suspense>
    </main>
  );
}
