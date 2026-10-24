import { notFound, redirect } from "nlite/navigation";

type Props = { params: Promise<{ id: string }> };

// No request APIs: the decision only depends on the param.
export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  if (id === "old") redirect("/meta-param/1");
  if (id !== "1") notFound();
  return { title: `Item ${id}` };
}

export default async function Page({ params }: Props) {
  const { id } = await params;
  return <h1 id="meta-param">Item {id}</h1>;
}
