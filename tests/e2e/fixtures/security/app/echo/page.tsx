import { cookies, headers } from "nlite/headers";

export const rendering = "force-ssr";

export default async function Page() {
  const store = await cookies();
  const list = await headers();
  return (
    <main>
      <p id="cookie">{store.get("name")?.value ?? ""}</p>
      <p id="header">{list.get("x-name") ?? ""}</p>
      <a id="link" href={store.get("href")?.value ?? "#"}>
        link
      </a>
    </main>
  );
}
