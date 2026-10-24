import { cookies } from "nlite/headers";
import { notFound, redirect } from "nlite/navigation";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const store = await cookies();
  if (id === "old") redirect("/items/1");
  if (id !== "1") notFound();
  return (
    <h1 id="item">
      Item {id} for {store.get("user")?.value ?? "anonymous"}
    </h1>
  );
}
