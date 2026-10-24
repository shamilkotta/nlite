import { cookies } from "nlite/headers";

export async function generateMetadata() {
  const store = await cookies();
  return { title: `Hello ${store.get("user")?.value ?? "anonymous"}` };
}

export default function Page() {
  return <h1 id="meta-cookies">Metadata reads cookies</h1>;
}
