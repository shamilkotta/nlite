import { headers } from "nlite/headers";

export default async function Page() {
  await headers();
  await new Promise((resolve) => setTimeout(resolve, 200));
  return <p id="child-content">Child content</p>;
}
