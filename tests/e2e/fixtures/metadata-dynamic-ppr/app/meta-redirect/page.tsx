import { cookies } from "nlite/headers";
import { redirect } from "nlite/navigation";

export async function generateMetadata() {
  const store = await cookies();
  if (!store.get("session")) redirect("/target?from=metadata");
  return { title: "Meta page" };
}

export default function Page() {
  return <h1 id="meta-page">Meta page</h1>;
}
