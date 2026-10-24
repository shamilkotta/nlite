import { cookies } from "nlite/headers";
import { notFound } from "nlite/navigation";

export async function generateMetadata() {
  const store = await cookies();
  if (!store.get("session")) notFound();
  return { title: "Meta page" };
}

export default function Page() {
  return <h1 id="meta-page">Meta page</h1>;
}
