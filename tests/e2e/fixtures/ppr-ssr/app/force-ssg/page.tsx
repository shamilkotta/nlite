import { Suspense } from "react";
import { cookies } from "nlite/headers";

export const rendering = "force-ssg";

async function Greeting() {
  const store = await cookies();
  return <p id="hole-user">{store.get("user")?.value ?? "anonymous"}</p>;
}

export default function Page() {
  return (
    <main>
      <p id="shell-id">{crypto.randomUUID()}</p>
      <Suspense fallback={<p id="fallback">Loading</p>}>
        <Greeting />
      </Suspense>
    </main>
  );
}
