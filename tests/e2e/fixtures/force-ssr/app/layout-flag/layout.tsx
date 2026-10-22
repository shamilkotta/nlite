import type { ReactNode } from "react";

// Only a page's `rendering` export is read; this one must have no effect.
export const rendering = "force-ssr";

export default function Layout({ children }: { children: ReactNode }) {
  return <section>{children}</section>;
}
