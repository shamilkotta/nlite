import { cookies } from "nlite/headers";

async function describe(options: { color: string; size: number }) {
  "use cache";
  return `${options.color}-${options.size}:${crypto.randomUUID()}`;
}

export default async function Page() {
  await cookies();
  const [first, reordered, different] = await Promise.all([
    describe({ color: "red", size: 1 }),
    describe({ size: 1, color: "red" }),
    describe({ color: "red", size: 2 }),
  ]);
  return (
    <main>
      <p id="first">{first}</p>
      <p id="reordered">{reordered}</p>
      <p id="different">{different}</p>
    </main>
  );
}
