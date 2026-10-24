import { cookies } from "nlite/headers";
import { notFound, redirect } from "nlite/navigation";

export default async function Page() {
  const store = await cookies();
  const session = store.get("session")?.value;
  if (!session) redirect("/target?reason=login");
  if (session === "banned") notFound();
  return <h1 id="welcome">Welcome {session}</h1>;
}
