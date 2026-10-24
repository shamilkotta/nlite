export async function generateStaticParams() {
  return { slug: "not-an-array" } as unknown as Array<{ slug: string }>;
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <p>{slug}</p>;
}
