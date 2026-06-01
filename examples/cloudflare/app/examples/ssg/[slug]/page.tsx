import Link from "nlite/link";

import { RenderProbe } from "../../../../components/render-probe";
import { getRenderTimestamp } from "../../../../lib/server/render-proof";

export async function generateStaticParams() {
  return [{ slug: "alpha" }, { slug: "beta" }];
}

const SLUG_COPY: Record<string, string> = {
  alpha: "First prebuilt slug",
  beta: "Second prebuilt slug",
};

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<URLSearchParams>;
}) {
  const { slug } = await params;
  const qs = await searchParams;
  const view = qs.get("view") ?? "list";
  const renderedAt = getRenderTimestamp();
  const isPrebuilt = slug in SLUG_COPY;

  return (
    <main className="main">
      <h1>SSG · {slug}</h1>
      <p className="muted">
        <code>generateStaticParams</code> prebuilds <code>alpha</code> and <code>beta</code>. This
        page also awaits <code>searchParams</code> — on prebuilt paths the view is baked at build;
        unknown slugs render per request.
      </p>

      <pre className="block">
        {JSON.stringify(
          {
            slug,
            view,
            isPrebuilt,
            renderedAt,
            label: SLUG_COPY[slug] ?? "Unknown slug — SSR",
          },
          null,
          2,
        )}
      </pre>

      <section className={`view-panel view-${view}`} aria-label={`${view} view`}>
        <p className="view-label">Active view: {view}</p>
        {view === "grid" ? (
          <ul className="slug-grid">
            <li>{slug}</li>
            <li>{SLUG_COPY[slug] ?? "dynamic"}</li>
          </ul>
        ) : (
          <p>{SLUG_COPY[slug] ?? `Live SSR page for "${slug}"`}</p>
        )}
      </section>

      <p className="muted">
        Prebuilt: <Link href="/examples/ssg/alpha?view=list">alpha · list</Link>
        {" · "}
        <Link href="/examples/ssg/alpha?view=grid">alpha · grid</Link>
        {" · "}
        <Link href="/examples/ssg/beta">beta</Link>
        <br />
        SSR: <Link href="/examples/ssg/gamma?view=list">gamma · list</Link>
        {" · "}
        <Link href="/examples/ssg/gamma?view=grid">gamma · grid</Link>
      </p>

      <RenderProbe serverRenderedAt={renderedAt} expected={isPrebuilt ? "frozen" : "live"} />

      <p>
        <Link href="/examples">← Examples</Link>
      </p>
    </main>
  );
}
