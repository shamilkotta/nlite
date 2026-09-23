import { getRenderTimestamp } from "../lib/timestamp";

export default function Page() {
  return (
    <main data-testid="page">
      <p data-testid="render-mode">auto-ssg</p>
      <p data-testid="rendered-at">{getRenderTimestamp()}</p>
    </main>
  );
}
