import type { ReactNode } from "react";
import { headers } from "nlite/headers";
import { notFound } from "nlite/navigation";

export default async function Layout({ children }: { children: ReactNode }) {
  const list = await headers();
  if (list.get("x-feature") !== "on") notFound();
  return <section id="feature-layout">{children}</section>;
}
