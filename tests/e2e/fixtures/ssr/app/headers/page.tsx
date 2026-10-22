import { headers } from "nlite/headers";

export default async function Page() {
  const requestHeaders = await headers();
  return (
    <>
      <p id="tag">{requestHeaders.get("x-e2e-tag") ?? "none"}</p>
      <p id="render-id">{crypto.randomUUID()}</p>
    </>
  );
}
