import Link from "nlite/link";

export default async function Page() {
  return (
    <main className="main">
      <h1>Auto SSG</h1>
      <p className="muted">
        No <code>rendering</code> export. If the tree is static, nlite prerenders this at build.
      </p>
      <p>
        <Link href="/examples">← Examples</Link>
      </p>
    </main>
  );
}
