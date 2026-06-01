import Link from "nlite/link";

import { RenderProbe } from "@/components/render-probe";
import { getRenderTimestamp } from "@/lib/server/render-proof";

export const rendering = "force-ssr";

export default function Page() {
  const renderedAt = getRenderTimestamp();

  return (
    <main className="main">
      <h1>force-ssr</h1>
      <p className="muted">
        <code>rendering = &quot;force-ssr&quot;</code> skips build prerender. No request APIs on
        this page — only a per-request timestamp proves SSR.
      </p>

      <RenderProbe serverRenderedAt={renderedAt} expected="live" />

      <p>
        <Link href="/examples/force-ssg">Compare force-ssg</Link>
        {" · "}
        <Link href="/examples">← Examples</Link>
      </p>
    </main>
  );
}
