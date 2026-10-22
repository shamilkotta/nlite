import { Suspense } from "react";
import { cookies } from "nlite/headers";

import { Counter } from "../components/counter";

async function Greeting() {
  const store = await cookies();
  return (
    <>
      <p id="hole-user">{store.get("user")?.value ?? "anonymous"}</p>
      <p id="hole-id">{crypto.randomUUID()}</p>
    </>
  );
}

export default function Page() {
  return (
    <main>
      <h1 id="heading">PPR home</h1>
      <p id="shell-id">{crypto.randomUUID()}</p>
      <Counter />
      <Suspense fallback={<p id="fallback">Loading greeting</p>}>
        <Greeting />
      </Suspense>
    </main>
  );
}
