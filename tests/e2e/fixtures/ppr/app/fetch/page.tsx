import { Suspense } from "react";
import { cookies } from "nlite/headers";

async function getJson(path: string, init?: RequestInit) {
  const response = await fetch(`${process.env.UPSTREAM_URL}${path}`, init);
  return (await response.json()) as { hit: number };
}

async function Hole() {
  await cookies();
  const [cached, live] = await Promise.all([
    getJson("/ppr-shell", { cache: "force-cache" }),
    getJson("/ppr-live"),
  ]);
  return (
    <>
      <p id="hole-cached">{cached.hit}</p>
      <p id="hole-live">{live.hit}</p>
    </>
  );
}

export default async function Page() {
  const shell = await getJson("/ppr-shell", { cache: "force-cache" });
  return (
    <main>
      <p id="shell-cached">{shell.hit}</p>
      <Suspense fallback={<p id="fallback">Loading</p>}>
        <Hole />
      </Suspense>
    </main>
  );
}
