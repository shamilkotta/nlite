import { cookies } from "nlite/headers";
import { redirect } from "nlite/navigation";

export default async function Page() {
  await cookies();
  redirect("/target");
}
