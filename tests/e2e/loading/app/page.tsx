import { delay } from "../lib/delay";

export default async function Page() {
  await delay(400);
  return (
    <main data-testid="loading-page">
      <h1>Loading route ready</h1>
    </main>
  );
}
