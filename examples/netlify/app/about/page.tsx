import Link from "nlite/link";
import { DynamicCmp } from "../../components/SCmp";
import { Suspense } from "react";

export default function AboutPage() {
  return (
    <div>
      <h1>About</h1>
      <Link href="/">Home</Link>

      <Suspense fallback={<div>Loading...</div>}>
        <DynamicCmp />
      </Suspense>
    </div>
  );
}
