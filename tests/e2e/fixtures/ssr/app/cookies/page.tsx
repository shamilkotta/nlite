import { cookies } from "nlite/headers";

export default async function Page() {
  const store = await cookies();
  return (
    <>
      <p id="user">{store.get("user")?.value ?? "anonymous"}</p>
      <p id="has-theme">{String(store.has("theme"))}</p>
      <p id="all">
        {store
          .getAll()
          .map((cookie) => `${cookie.name}=${cookie.value}`)
          .join(";")}
      </p>
      <p id="render-id">{crypto.randomUUID()}</p>
    </>
  );
}
