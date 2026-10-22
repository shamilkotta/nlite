import { cookies } from "nlite/headers";

import { RouterButtons } from "../../components/router-buttons";

export default async function Page() {
  await cookies();
  return (
    <main>
      <h1 id="page-router">Router</h1>
      <p id="render-id">{crypto.randomUUID()}</p>
      <RouterButtons />
    </main>
  );
}
