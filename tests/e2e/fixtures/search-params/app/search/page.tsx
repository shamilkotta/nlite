export default async function Page({ searchParams }: { searchParams: Promise<URLSearchParams> }) {
  const query = await searchParams;
  return (
    <>
      <p id="q">{query.get("q") ?? "empty"}</p>
      <p id="tags">{query.getAll("tag").join(",")}</p>
      <p id="render-id">{crypto.randomUUID()}</p>
    </>
  );
}
