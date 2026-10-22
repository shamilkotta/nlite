import { cookies, headers } from "nlite/headers";

export const rendering = "force-ssg";

export default async function Page({ searchParams }: { searchParams: Promise<URLSearchParams> }) {
  const [query, requestHeaders, store] = await Promise.all([searchParams, headers(), cookies()]);
  return (
    <>
      <p id="user">{store.get("user")?.value ?? "anonymous"}</p>
      <p id="tag">{requestHeaders.get("x-e2e-tag") ?? "none"}</p>
      <p id="q">{query.get("q") ?? "empty"}</p>
      <p id="render-id">{crypto.randomUUID()}</p>
    </>
  );
}
