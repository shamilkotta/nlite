import type { PropsWithChildren } from "react";
import Link from "nlite/link";

import "./styles.css";

export default function RootLayout({ children }: PropsWithChildren) {
  return (
    <div className="shell">
      <header className="site-header">
        <Link href="/" className="brand">
          nlite examples
        </Link>
        <nav className="site-nav">
          <Link href="/rendering/auto">Rendering</Link>
          <Link href="/docs">Docs</Link>
          <Link href="/demo/suspense">Demos</Link>
        </nav>
      </header>
      {children}
    </div>
  );
}
