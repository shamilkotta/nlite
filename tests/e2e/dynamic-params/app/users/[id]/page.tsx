import { getRenderTimestamp } from "../../../lib/timestamp";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main data-testid="page">
      <p data-testid="render-mode">dynamic-ssr</p>
      <p data-testid="user-id">{id}</p>
      <p data-testid="rendered-at">{getRenderTimestamp()}</p>
    </main>
  );
}
