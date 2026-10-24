import { notFound } from "nlite/navigation";

// Uncached fetch at the top level: no shell, decided per request.
export default async function Page() {
  const response = await fetch(`${process.env.UPSTREAM_URL}/missing-record`);
  const record = (await response.json()) as { hit: number };
  if (record.hit > 0) notFound();
  return <h1 id="record">Record</h1>;
}
