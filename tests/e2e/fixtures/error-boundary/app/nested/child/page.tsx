import { headers } from "nlite/headers";

export default async function Page() {
  await headers();
  throw new Error("nested child failure");
}
