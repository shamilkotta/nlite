import { cookies } from "nlite/headers";

export default async function Page() {
  await cookies();
  throw new Error("dynamic route failed");
}
