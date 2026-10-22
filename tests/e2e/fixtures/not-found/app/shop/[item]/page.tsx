import { headers } from "nlite/headers";
import { notFound } from "nlite/navigation";

export default async function Page({ params }: { params: Promise<{ item: string }> }) {
  await headers();
  const { item } = await params;
  if (item !== "boot") notFound();
  return <p id="item">{item}</p>;
}
