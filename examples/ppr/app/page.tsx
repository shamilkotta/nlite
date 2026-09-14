import { Suspense } from "react";
import { SCmp } from "../components/SCmp";

// export const rendering = "force-ssg";

export default async function Page() {
  return (
    <main className="main">
      <h1>Home</h1>
      <p className="muted">
        Static home route — no request APIs. The status timestamp below is from build output when
        prerendered.
      </p>
      <Suspense fallback={<div>Loading...</div>}>
        <SCmp />
      </Suspense>
    </main>
  );
}
