import Link from "nlite/link";

export default function Page() {
  return (
    <main className="main">
      <h1>Examples</h1>
      <p className="muted">
        Each route isolates one rendering signal. Use the render probe to verify.
      </p>

      <h2 className="h2">Manual overrides</h2>
      <ul className="link-list">
        <li>
          <Link href="/examples/force-ssg">force-ssg</Link>
          <span className="muted">
            {" "}
            — uses headers/cookies/searchParams but output is build-frozen
          </span>
        </li>
        <li>
          <Link href="/examples/force-ssr">force-ssr</Link>
          <span className="muted"> — always SSR; live timestamp only</span>
        </li>
      </ul>

      <h2 className="h2">Automatic detection</h2>
      <ul className="link-list">
        <li>
          <Link href="/examples/auto">auto</Link>
          <span className="muted"> — no request APIs → prerender</span>
        </li>
        <li>
          <Link href="/examples/ssg/alpha">ssg/alpha</Link>
          <span className="muted"> — prebuilt; ?view= baked at build</span>
        </li>
        <li>
          <Link href="/examples/ssg/alpha?view=grid">ssg/alpha?view=grid</Link>
          <span className="muted"> — same static file (view stays build default)</span>
        </li>
        <li>
          <Link href="/examples/ssg/gamma?view=grid">ssg/gamma?view=grid</Link>
          <span className="muted"> — no static param → SSR with live ?view=</span>
        </li>
        <li>
          <Link href="/users/alice">users/alice</Link>
          <span className="muted"> — unfixed [id] → SSR; reads headers + cookies</span>
        </li>
        <li>
          <Link href="/examples/server-fetch">server-fetch</Link>
          <span className="muted"> — uncached fetch() → auto SSR</span>
        </li>
      </ul>

      <p>
        <Link href="/">← Home</Link>
      </p>
    </main>
  );
}
