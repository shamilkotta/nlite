export const rendering = "force-ssr";

export default async function Page({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;

  return (
    <main>
      <h1>Docs</h1>
      <p>Segments: {slug.join(" / ")}</p>
    </main>
  );
}
