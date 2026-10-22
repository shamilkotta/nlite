import { Suspense } from "react";

async function Results({ searchParams }: { searchParams: Promise<URLSearchParams> }) {
  const query = await searchParams;
  return <p id="q">{query.get("q") ?? "empty"}</p>;
}

export default function Page({ searchParams }: { searchParams: Promise<URLSearchParams> }) {
  return (
    <main>
      <h1 id="heading">Search</h1>
      <Suspense fallback={<p id="fallback">Loading results</p>}>
        <Results searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
