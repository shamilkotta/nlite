import { getRenderTimestamp } from "../../lib/timestamp";

export const rendering = "force-ssr";

export default function Page() {
  return (
    <main data-testid="force-ssr-page">
      <p data-testid="render-mode">force-ssr</p>
      <p data-testid="rendered-at">{getRenderTimestamp()}</p>
    </main>
  );
}
