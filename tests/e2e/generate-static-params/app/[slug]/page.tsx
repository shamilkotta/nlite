import { getRenderTimestamp } from "../../lib/timestamp";

export async function generateStaticParams() {
  return [{ slug: "alpha" }, { slug: "beta" }];
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<URLSearchParams>;
}) {
  const { slug } = await params;
  const qs = await searchParams;
  const view = qs.get("view") ?? "list";
  const isPrebuilt = slug === "alpha" || slug === "beta";

  return (
    <main data-testid="page">
      <p data-testid="render-mode">{isPrebuilt ? "ssg-prebuilt" : "ssg-dynamic"}</p>
      <p data-testid="slug">{slug}</p>
      <p data-testid="view">{view}</p>
      <p data-testid="rendered-at">{getRenderTimestamp()}</p>
    </main>
  );
}
