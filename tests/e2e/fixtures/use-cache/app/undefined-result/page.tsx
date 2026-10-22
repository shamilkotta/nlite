import { cookies } from "nlite/headers";

async function nothing(): Promise<undefined> {
  "use cache";
  return undefined;
}

export default async function Page() {
  await cookies();
  const value = await nothing();
  return <p id="value">{String(value)}</p>;
}
