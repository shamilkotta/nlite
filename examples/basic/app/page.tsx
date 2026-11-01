import Link from "nlite/link";

import { RenderProbe } from "@/components/render-probe";
import { getRenderTimestamp } from "@/lib/server/render-proof";

export default async function Page() {
  const renderedAt = getRenderTimestamp();

  return (
    <main className="main">
      <h1>Home</h1>
      <p className="muted">
        Static home route — no request APIs. The status timestamp below is from build output when
        prerendered.
      </p>

      <RenderProbe serverRenderedAt={renderedAt} expected="frozen" />

      <h2 className="h2">Examples</h2>
      <ul className="link-list">
        <li>
          <Link href="/examples/auto">auto</Link>
          <span className="muted"> — static tree</span>
        </li>
        <li>
          <Link href="/examples/force-ssg">force-ssg</Link>
          <span className="muted"> — request APIs, frozen at build</span>
        </li>
        <li>
          <Link href="/examples/force-ssr">force-ssr</Link>
          <span className="muted"> — manual SSR</span>
        </li>
        <li>
          <Link href="/examples/ssg/alpha">ssg/[slug]</Link>
          <span className="muted"> — generateStaticParams + searchParams</span>
        </li>
        <li>
          <Link href="/examples/ssg/gamma?view=grid">ssg/gamma?view=grid</Link>
          <span className="muted"> — unknown slug → SSR</span>
        </li>
        <li>
          <Link href="/users/alice">users/[id]</Link>
          <span className="muted"> — dynamic segment + headers/cookies</span>
        </li>
        <li>
          <Link href="/examples/server-fetch">server-fetch</Link>
          <span className="muted"> — fetch() → auto SSR</span>
        </li>
      </ul>

      <p>
        <Link href="/examples">All examples →</Link>
      </p>
    </main>
  );
}
