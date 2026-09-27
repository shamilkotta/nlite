import { Suspense } from "react";
import Link from "nlite/link";
import { cookies } from "nlite/headers";

export default function Page() {
  return (
    <main className="main">
      <h1>PPR</h1>
      <p className="muted" data-testid="ppr-shell">
        Static shell from the eyeball Worker. The hole below resumes on the Smart Placement origin.
      </p>

      <Suspense fallback={<p data-testid="ppr-fallback">Loading dynamic…</p>}>
        <DynamicHole />
      </Suspense>

      <p>
        <Link href="/examples">← Examples</Link>
      </p>
    </main>
  );
}

async function DynamicHole() {
  const cookieStore = await cookies();
  return (
    <pre className="block" data-testid="ppr-dynamic">
      {JSON.stringify(
        {
          visitor: cookieStore.get("visitor")?.value ?? "anon",
          renderedAt: new Date().toISOString(),
        },
        null,
        2,
      )}
    </pre>
  );
}
