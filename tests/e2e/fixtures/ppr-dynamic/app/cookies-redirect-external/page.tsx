import { cookies } from "nlite/headers";
import { redirect } from "nlite/navigation";

export default async function Page() {
  await cookies();
  redirect("https://example.com/login?next=%2Fdashboard");
}
