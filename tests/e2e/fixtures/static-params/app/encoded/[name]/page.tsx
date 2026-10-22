export function generateStaticParams() {
  return [{ name: "hello world" }];
}

export default async function Page({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  return (
    <>
      <p id="name">{name}</p>
      <p id="render-id">{crypto.randomUUID()}</p>
    </>
  );
}
