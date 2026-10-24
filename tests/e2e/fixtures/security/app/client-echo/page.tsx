import { cookies } from "nlite/headers";

import { Echo } from "./echo";

export const rendering = "force-ssr";

// The value travels to the client in the inline RSC payload <script>.
export default async function Page() {
  const store = await cookies();
  return <Echo value={store.get("name")?.value ?? ""} />;
}
