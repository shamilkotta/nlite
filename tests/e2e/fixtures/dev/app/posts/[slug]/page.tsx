export async function generateStaticParams() {
  return [{ slug: "listed" }];
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <p id="slug">{slug}</p>;
}
