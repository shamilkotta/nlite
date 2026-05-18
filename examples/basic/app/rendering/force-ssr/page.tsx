import { PageHeader } from "../../../components/PageHeader";
import { formatTime } from "../../../lib/content";

export const rendering = "force-ssr";

export default async function ForceSsrPage() {
  const generatedAt = formatTime(new Date());

  return (
    <section className="stack">
      <PageHeader
        eyebrow="Rendering"
        title="force-ssr"
        description="Excluded from the static path collector. Each request renders a fresh HTML and RSC response."
        badge="force-ssr"
      />
      <div className="panel">
        <p>
          Request time: <code>{generatedAt}</code>
        </p>
        <p className="meta">Reload to see the timestamp change in dev and preview.</p>
      </div>
    </section>
  );
}
