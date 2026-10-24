import { cookies } from "nlite/headers";
import { notFound } from "nlite/navigation";

export default async function Page() {
  await cookies();
  notFound();
}
