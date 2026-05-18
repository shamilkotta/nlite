import { PageHeader } from "../../../components/PageHeader";

export default async function SuspenseDemoPage() {
  await new Promise((resolve) => setTimeout(resolve, 1200));

  return (
    <section className="stack">
      <PageHeader
        eyebrow="Demos"
        title="Suspense boundary"
        description="loading.tsx in this segment wraps the page while async server work completes."
        badge="loading.tsx"
      />
      <div className="panel">
        <p>The delayed server content is ready.</p>
      </div>
    </section>
  );
}
