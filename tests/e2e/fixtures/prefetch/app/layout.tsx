import type { ReactNode } from "react";
import Link from "nlite/link";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <div id="root-layout">
      <nav>
        <Link id="link-home" href="/">
          home
        </Link>
        <Link id="link-static" href="/static">
          static
        </Link>
        <Link id="link-ppr" href="/ppr">
          ppr
        </Link>
        <Link id="link-dynamic" href="/dynamic/1">
          dynamic
        </Link>
        <Link id="link-items" href="/items/1">
          items
        </Link>
        <Link id="link-no-shell" href="/no-shell">
          no shell
        </Link>
      </nav>
      {children}
    </div>
  );
}
