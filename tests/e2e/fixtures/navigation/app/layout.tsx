import type { ReactNode } from "react";
import Link from "nlite/link";

import { CurrentPath } from "../components/current-path";
import { LayoutCounter } from "../components/layout-counter";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div id="root-layout">
          <LayoutCounter />
          <CurrentPath />
          <Link id="nav-home" href="/" prefetch={false}>
            home
          </Link>
          {children}
        </div>
      </body>
    </html>
  );
}
