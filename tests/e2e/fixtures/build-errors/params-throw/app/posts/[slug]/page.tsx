export async function generateStaticParams(): Promise<Array<{ slug: string }>> {
  throw new Error("E2E_PARAMS_THROW");
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <p>{slug}</p>;
}
