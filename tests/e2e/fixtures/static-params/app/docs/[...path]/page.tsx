export function generateStaticParams() {
  return [{ path: ["intro"] }, { path: ["guide", "install"] }];
}

export default async function Page({ params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return (
    <>
      <p id="path">{JSON.stringify(path)}</p>
      <p id="render-id">{crypto.randomUUID()}</p>
    </>
  );
}
