import type { ReactNode } from "react";

export default function RootLayout({ children }: { children: ReactNode }) {
  return <div id="root-layout">{children}</div>;
}
