import type { Metadata } from "nlite";
import { headers } from "nlite/headers";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<URLSearchParams>;
}): Promise<Metadata> {
  const query = await searchParams;
  return { title: `Search: ${query.get("q") ?? "all"}` };
}

export default async function Page() {
  await headers();
  return <h1>Search</h1>;
}
