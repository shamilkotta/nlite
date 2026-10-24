import { Suspense } from "react";
import { cookies } from "nlite/headers";
import { notFound } from "nlite/navigation";

async function Hole() {
  await cookies();
  notFound();
  return null;
}

export default function Page() {
  return (
    <main>
      <h1 id="shell">Shell</h1>
      <Suspense fallback={<p id="fallback">Loading</p>}>
        <Hole />
      </Suspense>
    </main>
  );
}
