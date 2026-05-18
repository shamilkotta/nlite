import { PageHeader } from "../../../components/PageHeader";
import { formatTime } from "../../../lib/content";

export default function AutoStaticPage() {
  const generatedAt = formatTime();

  return (
    <section className="stack">
      <PageHeader
        eyebrow="Rendering"
        title="Auto static"
        description="No rendering export. nlite probes the route tree and prerenders when the page is fully static."
        badge="Auto SSG"
      />
      <div className="panel">
        <p>
          Generated at build or probe time: <code>{generatedAt}</code>
        </p>
      </div>
    </section>
  );
}
