import Link from "nlite/link";
import { cookies, headers } from "nlite/headers";

import { RenderProbe } from "@/components/render-probe";
import { getRenderTimestamp } from "@/lib/server/render-proof";

export const rendering = "force-ssg";

export default async function Page({ searchParams }: { searchParams: Promise<URLSearchParams> }) {
  const [qs, requestHeaders, cookieStore] = await Promise.all([searchParams, headers(), cookies()]);
  const renderedAt = getRenderTimestamp();
  const requestSnapshot = {
    searchParams: Object.fromEntries(qs.entries()),
    accept: requestHeaders.get("accept"),
    theme: cookieStore.get("theme")?.value ?? null,
    visitor: cookieStore.get("visitor")?.value ?? null,
  };

  return (
    <main className="main">
      <h1>force-ssg</h1>
      <p className="muted">
        Calls <code>headers()</code>, <code>cookies()</code>, and <code>searchParams</code>, but{" "}
        <code>rendering = &quot;force-ssg&quot;</code> still emits static HTML at build. Values
        below are from the prerender pass, not your current request.
      </p>

      <pre className="block">
        {JSON.stringify(
          { signal: "force-ssg + request APIs", renderedAt, requestSnapshot },
          null,
          2,
        )}
      </pre>
      <RenderProbe serverRenderedAt={renderedAt} expected="frozen" />

      <p className="muted">
        Try <Link href="/examples/force-ssg?ref=demo">?ref=demo</Link>, set <code>theme=dark</code>{" "}
        or <code>visitor=you</code> cookies — output should not change after a hard refresh.
      </p>

      <p>
        <Link href="/examples/force-ssr">Compare force-ssr</Link>
        {" · "}
        <Link href="/examples">← Examples</Link>
      </p>
    </main>
  );
}
