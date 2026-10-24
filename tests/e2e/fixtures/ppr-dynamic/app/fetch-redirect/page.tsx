import { redirect } from "nlite/navigation";

export default async function Page() {
  const response = await fetch(`${process.env.UPSTREAM_URL}/moved-record`);
  const record = (await response.json()) as { hit: number };
  if (record.hit > 0) redirect(`/target?hit=${record.hit}`);
  return <h1 id="record">Record</h1>;
}
