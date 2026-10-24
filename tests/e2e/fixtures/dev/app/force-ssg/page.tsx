import { cookies } from "nlite/headers";

export const rendering = "force-ssg";

export default async function Page() {
  const store = await cookies();
  return <p id="user">{store.get("user")?.value ?? "anonymous"}</p>;
}
