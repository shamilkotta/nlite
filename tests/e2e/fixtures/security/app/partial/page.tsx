import { Suspense } from "react";
import { cookies } from "nlite/headers";

async function Hole() {
  const store = await cookies();
  return <p id="hole">{store.get("name")?.value ?? ""}</p>;
}

export default function Page() {
  return (
    <main>
      <h1 id="shell">Shell</h1>
      <Suspense fallback={<p>Loading</p>}>
        <Hole />
      </Suspense>
    </main>
  );
}
