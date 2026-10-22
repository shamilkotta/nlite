import { cookies } from "nlite/headers";
import { redirect } from "nlite/navigation";

export default async function Page() {
  const store = await cookies();
  if (!store.has("session")) redirect("/target?reason=login");
  return <p id="secret">Signed in as {store.get("session")?.value}</p>;
}
