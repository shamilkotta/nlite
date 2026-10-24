import { Suspense } from "react";
import { cookies } from "nlite/headers";

async function User() {
  const store = await cookies();
  return <p id="user">{store.get("user")?.value ?? "anonymous"}</p>;
}

export default function Page() {
  return (
    <main>
      <h1 id="shell">Partial shell</h1>
      <Suspense fallback={<p id="fallback">Loading</p>}>
        <User />
      </Suspense>
    </main>
  );
}
