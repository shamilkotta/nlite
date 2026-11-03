import { Suspense } from "react";

import { SlowUser } from "../../../components/slow-user";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main>
      <h1 id="dynamic-shell">Dynamic {id}</h1>
      <Suspense fallback={<p id="dynamic-fallback">Loading user</p>}>
        <SlowUser id="dynamic-user" />
      </Suspense>
    </main>
  );
}
