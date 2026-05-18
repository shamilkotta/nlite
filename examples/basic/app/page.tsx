import { Counter } from "../components/Counter";
import { PageHeader } from "../components/PageHeader";
import { RouteCard } from "../components/RouteCard";
import { showcaseRoutes } from "../lib/routes";

export default function HomePage() {
  return (
    <>
      <PageHeader
        eyebrow="Example app"
        title="nlite feature showcase"
        description="A minimal reference app covering static routes, dynamic segments, rendering modes, layouts, and client navigation."
        badge="Node"
      />
      <section className="stack">
        <div className="panel">
          <Counter />
        </div>
        <div className="route-grid">
          {showcaseRoutes.map((route) => (
            <RouteCard key={route.href} {...route} />
          ))}
        </div>
      </section>
    </>
  );
}
