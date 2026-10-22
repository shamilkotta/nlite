import { headers } from "nlite/headers";
import { notFound } from "nlite/navigation";

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  await headers();
  const { slug } = await params;
  if (slug !== "hello") notFound();
  return <p id="slug">{slug}</p>;
}
