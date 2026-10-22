import { Suspense } from "react";
import { headers } from "nlite/headers";
import { redirect } from "nlite/navigation";

async function LateRedirect() {
  await headers();
  await new Promise((resolve) => setTimeout(resolve, 50));
  redirect("/target");
  return null;
}

export default function Page() {
  return (
    <main>
      <h1 id="streamed-shell">Already streaming</h1>
      <Suspense fallback={<p id="fallback">Loading</p>}>
        <LateRedirect />
      </Suspense>
    </main>
  );
}
