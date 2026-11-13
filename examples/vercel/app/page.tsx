import { Suspense } from "react";
import { cookies } from "nlite/headers";

export default function Page() {
  return (
    <main>
      <h1>Partial Prerendering</h1>
      <p className="muted">This shell is prerendered at build time.</p>
      <BuildTime />
      <Suspense fallback={<p className="muted">Loading visitor...</p>}>
        <Visitor />
      </Suspense>
    </main>
  );
}

async function BuildTime() {
  "use cache";

  return <p>Cached at build: {new Date().toISOString()}</p>;
}

async function Visitor() {
  const cookieStore = await cookies();
  const name = cookieStore.get("name")?.value ?? "stranger";

  return (
    <p>
      Hello {name}, rendered at {new Date().toISOString()}
    </p>
  );
}
