import type { ReactNode } from "react";
import { headers } from "nlite/headers";

export default async function Layout({ children }: { children: ReactNode }) {
  const requestHeaders = await headers();
  return (
    <section>
      <p id="layout-tag">{requestHeaders.get("x-e2e-tag") ?? "none"}</p>
      {children}
    </section>
  );
}
