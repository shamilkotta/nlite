import { headers } from "nlite/headers";

export default async function Page() {
  await headers();
  throw new Error("database password is SUPER_SECRET_VALUE_123");
}
