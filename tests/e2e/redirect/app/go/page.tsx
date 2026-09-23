import { redirect } from "nlite/navigation";

export const rendering = "force-ssr";

export default function Page() {
  redirect("/");
}
