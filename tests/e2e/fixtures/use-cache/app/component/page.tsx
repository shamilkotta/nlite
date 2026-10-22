async function CachedCard({ title }: { title: string }) {
  "use cache";
  return (
    <article>
      <h2 id="card-title">{title}</h2>
      <p id="card-id">{crypto.randomUUID()}</p>
    </article>
  );
}

export default function Page() {
  return <CachedCard title="Cached component" />;
}
