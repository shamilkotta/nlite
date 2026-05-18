import { PageHeader } from "../../../components/PageHeader";
import { formatTime } from "../../../lib/content";

export const rendering = "force-ssg";

export default function ForceSsgPage() {
  const generatedAt = formatTime();

  return (
    <section className="stack">
      <PageHeader
        eyebrow="Rendering"
        title="force-ssg"
        description="This page always ships as static HTML and an RSC payload, even if the tree contains async work that would otherwise opt out."
        badge="force-ssg"
      />
      <div className="panel">
        <p>
          Build output timestamp: <code>{generatedAt}</code>
        </p>
        <p className="meta">
          Refresh in production preview — the value should stay fixed between reloads.
        </p>
      </div>
    </section>
  );
}
