import Link from "nlite/link";
import { cookies, headers } from "nlite/headers";

import { RenderProbe } from "@/components/render-probe";
import { getUserPublicRecord } from "@/lib/server/app-data";
import { getRenderTimestamp } from "@/lib/server/render-proof";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, cookieStore, requestHeaders] = await Promise.all([params, cookies(), headers()]);
  const user = getUserPublicRecord(id);
  const renderedAt = getRenderTimestamp();
  const theme = cookieStore.get("theme")?.value ?? "light";
  const visitor = cookieStore.get("visitor")?.value;
  const acceptLanguage = requestHeaders.get("accept-language")?.split(",")[0]?.trim() ?? "unknown";

  return (
    <main className="main">
      <h1>User · {user.id}</h1>
      <p className="muted">
        Unfixed dynamic segment — no <code>generateStaticParams()</code>, so nlite SSRs this route.
        Reads <code>headers()</code> and <code>cookies()</code> from the incoming request.
      </p>

      <div className={`user-panel theme-${theme}`}>
        <p>
          {visitor ? `Welcome back, ${visitor}` : "Set a visitor cookie to personalize this panel."}
        </p>
        <p className="muted">Accept-Language: {acceptLanguage}</p>
      </div>

      <pre className="block">
        {JSON.stringify(
          {
            signal: "dynamic [id] + headers + cookies",
            user,
            theme,
            visitor: visitor ?? null,
            acceptLanguage,
            renderedAt,
          },
          null,
          2,
        )}
      </pre>

      <RenderProbe serverRenderedAt={renderedAt} expected="live" />

      <p className="muted">
        Set cookies <code>theme=dark</code> and <code>visitor=alice</code> in devtools, then
        refresh.
      </p>

      <p>
        <Link href="/users/bob">/users/bob</Link>
        {" · "}
        <Link href="/examples">Examples</Link>
        {" · "}
        <Link href="/">Home</Link>
      </p>
    </main>
  );
}
