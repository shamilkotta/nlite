import { Suspense } from "react";
import { cookies, headers } from "nlite/headers";

async function FromCookie() {
  const store = await cookies();
  return <p id="from-cookie">{store.get("user")?.value ?? "anonymous"}</p>;
}

async function FromHeader() {
  const requestHeaders = await headers();
  return <p id="from-header">{requestHeaders.get("x-e2e-tag") ?? "none"}</p>;
}

export default function Page() {
  return (
    <main>
      <p id="shell-id">{crypto.randomUUID()}</p>
      <Suspense fallback={<p id="cookie-fallback">Loading cookie</p>}>
        <FromCookie />
      </Suspense>
      <p id="between">static between holes</p>
      <Suspense fallback={<p id="header-fallback">Loading header</p>}>
        <FromHeader />
      </Suspense>
    </main>
  );
}
