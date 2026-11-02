import { cookies } from "nlite/headers";

export async function SlowUser({ id }: { id: string }) {
  const store = await cookies();
  await new Promise((resolve) => setTimeout(resolve, 1500));
  return <p id={id}>{store.get("user")?.value ?? "anonymous"}</p>;
}
