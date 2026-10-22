export function generateStaticParams() {
  return [{ id: "x" }];
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<URLSearchParams>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  return (
    <>
      <p id="id">{id}</p>
      <p id="view">{query.get("view") ?? "default"}</p>
    </>
  );
}
