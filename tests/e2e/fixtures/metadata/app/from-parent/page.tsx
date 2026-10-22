import type { Metadata } from "nlite";

export async function generateMetadata(
  _props: unknown,
  parent: Promise<Metadata>,
): Promise<Metadata> {
  const parentMetadata = await parent;
  return { title: "Child", description: `${parentMetadata.description} (extended)` };
}

export default function Page() {
  return <h1>From parent</h1>;
}
