export function generateStaticParams() {
  return [{ category: "shoes", item: "boot" }];
}

export default async function Page({
  params,
}: {
  params: Promise<{ category: string; item: string }>;
}) {
  const { category, item } = await params;
  return (
    <>
      <p id="category">{category}</p>
      <p id="item">{item}</p>
      <p id="render-id">{crypto.randomUUID()}</p>
    </>
  );
}
