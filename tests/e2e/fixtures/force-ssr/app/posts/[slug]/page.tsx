export const rendering = "force-ssr";

export function generateStaticParams() {
  return [{ slug: "first" }, { slug: "second" }];
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <>
      <p id="slug">{slug}</p>
      <p id="render-id">{crypto.randomUUID()}</p>
    </>
  );
}
