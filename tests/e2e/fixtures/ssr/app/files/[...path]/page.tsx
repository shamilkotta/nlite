export default async function Page({ params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return <p id="path">{JSON.stringify(path)}</p>;
}
