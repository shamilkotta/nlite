import { headers } from "nlite/headers";

export default async function Page() {
  await headers();
  await new Promise((resolve) => setTimeout(resolve, 400));
  return <p id="content">Slow content</p>;
}
