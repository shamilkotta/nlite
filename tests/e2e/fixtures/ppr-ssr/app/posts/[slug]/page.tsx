import { Suspense } from "react";
import { cookies } from "nlite/headers";

export function generateStaticParams() {
  return [{ slug: "alpha" }, { slug: "beta" }];
}

async function Viewer({ slug }: { slug: string }) {
  const store = await cookies();
  return (
    <p id="viewer">
      {slug}:{store.get("user")?.value ?? "anonymous"}
    </p>
  );
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <main>
      <h1 id="slug">{slug}</h1>
      <p id="shell-id">{crypto.randomUUID()}</p>
      <Suspense fallback={<p id="fallback">Loading viewer</p>}>
        <Viewer slug={slug} />
      </Suspense>
    </main>
  );
}
