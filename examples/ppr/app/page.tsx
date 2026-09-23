import { Suspense } from "react";
import { DynamicCmp, DynamicCmp2, DynamicCmp3, SCmp } from "../components/SCmp";
import CCmp from "../components/CCmp";
import Link from "nlite/link";

// export const rendering = "force-ssg";

export default async function Page() {
  return (
    <main className="main">
      <h1>Home</h1>
      <Link href="/about">About Page</Link>
      <p className="muted">
        Static home route — no request APIs. The status timestamp below is from build output when
        prerendered.
      </p>
      <CCmp />
      <Suspense fallback={<div>Loading...</div>}>
        <SCmp />
      </Suspense>
      <Suspense fallback={<div>Loading...</div>}>
        <DynamicCmp />
      </Suspense>
      {/* <Suspense fallback={<div>Loading...</div>}> */}
      <DynamicCmp2 />
      {/* </Suspense> */}
      <Suspense fallback={<div>Loading...1.2.3...</div>}>
        <DynamicCmp3 />
      </Suspense>
      {/* <DynamicCmp3 /> */}
    </main>
  );
}
