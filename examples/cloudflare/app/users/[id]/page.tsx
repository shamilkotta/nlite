import { PageHeader } from "../../../components/PageHeader";
import { formatTime } from "../../../lib/content";

export default async function UserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <section className="stack">
      <PageHeader
        eyebrow="Dynamic route"
        title={`User ${id}`}
        description="No generateStaticParams and no force-ssg — this route is rendered per request."
        badge="SSR"
      />
      <div className="panel">
        <p>
          Resolved at request time: <code>{formatTime()}</code>
        </p>
      </div>
    </section>
  );
}
