import type { ReactNode } from "react";

import "./styles.css";

export default function RootLayout({ children }: { children: ReactNode }) {
  return <div id="root-layout">{children}</div>;
}
