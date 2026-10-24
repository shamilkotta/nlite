import { headers } from "nlite/headers";

export const rendering = "force-ssr";

export default async function Page() {
  const list = await headers();
  return <h1 id="ssr">{list.get("x-e2e") ?? "none"}</h1>;
}
