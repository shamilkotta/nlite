import { PageHeader } from "../../../components/PageHeader";

export default async function ExplorerPage({
  params,
}: {
  params: Promise<{ path: string[] }>;
}) {
  const { path } = await params;
  const segments = Array.isArray(path) ? path : [path].filter(Boolean);

  return (
    <section className="stack">
      <PageHeader
        eyebrow="Catch-all"
        title="Path explorer"
        description="The [...path] segment captures the remainder of the URL as an array."
        badge="[...path]"
      />
      <div className="panel">
        <p className="meta">Segments</p>
        <ul className="doc-list">
          {segments.length === 0 ? (
            <li className="panel">No path segments provided.</li>
          ) : (
            segments.map((segment, index) => (
              <li key={`${segment}-${index}`} className="panel">
                {index + 1}. {segment}
              </li>
            ))
          )}
        </ul>
      </div>
    </section>
  );
}
