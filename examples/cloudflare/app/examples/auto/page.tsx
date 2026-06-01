import Link from "nlite/link";

import { RenderProbe } from "../../../components/render-probe";
import { getRenderTimestamp } from "../../../lib/server/render-proof";

export default async function Page() {
  const renderedAt = getRenderTimestamp();

  return (
    <main className="main">
      <h1>Auto SSG</h1>
      <p className="muted">
        No <code>rendering</code> export and no request APIs. nlite prerenders this route at build.
      </p>

      <pre className="block">{JSON.stringify({ signal: "none", renderedAt }, null, 2)}</pre>
      <RenderProbe serverRenderedAt={renderedAt} expected="frozen" />

      <p>
        <Link href="/examples">← Examples</Link>
      </p>
    </main>
  );
}
