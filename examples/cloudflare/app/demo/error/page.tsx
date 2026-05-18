import { ErrorTrigger } from "../../../components/ErrorTrigger";
import { PageHeader } from "../../../components/PageHeader";

export default function ErrorDemoPage() {
  return (
    <section className="stack">
      <PageHeader
        eyebrow="Demos"
        title="Error boundary"
        description="Segment error.tsx handles failures from client components in this route."
        badge="error.tsx"
      />
      <div className="panel">
        <ErrorTrigger />
      </div>
    </section>
  );
}
