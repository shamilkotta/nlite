import Link from "nlite/link";

export const rendering = "force-ssr";

export default async function Page() {
  return (
    <main className="main">
      <h1>force-ssr</h1>
      <p className="muted">
        <code>rendering = &quot;force-ssr&quot;</code> — skipped at build; rendered on each request.
      </p>
      <pre className="block">{new Date().toISOString()}</pre>
      <p>
        <Link href="/examples">← Examples</Link>
      </p>
    </main>
  );
}
