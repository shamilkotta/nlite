import { cookies } from "nlite/headers";

export default async function Page() {
  await cookies();
  return (
    <>
      <h1 id="page-dynamic">Dynamic</h1>
      <p id="render-id">{crypto.randomUUID()}</p>
    </>
  );
}
