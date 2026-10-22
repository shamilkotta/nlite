import { cookies } from "nlite/headers";

export const rendering = "force-ssg";

export function generateStaticParams() {
  return [{ slug: "one" }, { slug: "two" }];
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await cookies();
  return (
    <>
      <p id="slug">{slug}</p>
      <p id="user">{store.get("user")?.value ?? "anonymous"}</p>
      <p id="render-id">{crypto.randomUUID()}</p>
    </>
  );
}
