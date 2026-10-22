import type { ReactNode } from "react";
import { headers } from "nlite/headers";
import { redirect } from "nlite/navigation";

export default async function Layout({ children }: { children: ReactNode }) {
  const requestHeaders = await headers();
  if (requestHeaders.get("x-allow") !== "yes") redirect("/target");
  return <section>{children}</section>;
}
