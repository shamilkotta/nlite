export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <>
      <p id="item">{id}</p>
      <p id="render-id">{crypto.randomUUID()}</p>
    </>
  );
}
