import { cookies } from "nlite/headers";

// Reads request data outside any Suspense boundary, so there is no static shell to keep.
export default async function Page() {
  const store = await cookies();
  return (
    <>
      <p id="user">{store.get("user")?.value ?? "anonymous"}</p>
      <p id="render-id">{crypto.randomUUID()}</p>
    </>
  );
}
