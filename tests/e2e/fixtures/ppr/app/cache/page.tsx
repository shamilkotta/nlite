import { Suspense } from "react";
import { cookies } from "nlite/headers";

async function stamp(label: string) {
  "use cache";
  return `${label}:${crypto.randomUUID()}`;
}

async function Hole() {
  await cookies();
  const [shared, holeOnly] = await Promise.all([stamp("shared"), stamp("hole-only")]);
  return (
    <>
      <p id="hole-shared">{shared}</p>
      <p id="hole-only">{holeOnly}</p>
    </>
  );
}

export default async function Page() {
  const shared = await stamp("shared");
  return (
    <main>
      <p id="shell-shared">{shared}</p>
      <Suspense fallback={<p id="fallback">Loading</p>}>
        <Hole />
      </Suspense>
    </main>
  );
}
