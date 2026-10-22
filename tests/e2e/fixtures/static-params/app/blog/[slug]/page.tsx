import { notFound } from "nlite/navigation";

export async function generateStaticParams() {
  await new Promise((resolve) => setTimeout(resolve, 10));
  return [{ slug: "first" }, { slug: "second" }];
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (slug === "gone") notFound();

  return (
    <>
      <p id="slug">{slug}</p>
      <p id="render-id">{crypto.randomUUID()}</p>
    </>
  );
}
