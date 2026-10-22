import { headers } from "nlite/headers";
import { redirect } from "nlite/navigation";

export default async function Page() {
  await headers();
  redirect("/target");
}
