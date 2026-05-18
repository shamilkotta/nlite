import Link from "nlite/link";

export const rendering = "force-ssg";

export default async function Page() {
  return (
    <main className="main">
      <h1>force-ssg</h1>
      <p className="muted">
        <code>rendering = &quot;force-ssg&quot;</code> — always emitted as static HTML + RSC at
        build.
      </p>
      <p>
        <Link href="/examples">← Examples</Link>
      </p>
    </main>
  );
}
