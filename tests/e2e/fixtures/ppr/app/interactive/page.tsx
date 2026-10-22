import { Suspense } from "react";
import { cookies } from "nlite/headers";

import { Counter } from "../../components/counter";

// The shell must render the same output at build time and when the route is resumed;
// "use cache" carries the build-time value over to the resumed render.
async function getBuildId() {
  "use cache";
  return crypto.randomUUID();
}

async function Greeting() {
  const store = await cookies();
  return <p id="hole-user">{store.get("user")?.value ?? "anonymous"}</p>;
}

export default async function Page() {
  return (
    <main>
      <p id="build-id">{await getBuildId()}</p>
      <Counter />
      <Suspense fallback={<p id="fallback">Loading greeting</p>}>
        <Greeting />
      </Suspense>
    </main>
  );
}
