import type { ReactNode } from "react";
import { cookies } from "nlite/headers";
import { redirect } from "nlite/navigation";

export default async function GuardedLayout({ children }: { children: ReactNode }) {
  const store = await cookies();
  if (!store.get("session")) redirect("/target?reason=guard");
  return <section id="guarded-layout">{children}</section>;
}
