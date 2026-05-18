import type { PropsWithChildren } from "react";
import Link from "nlite/link";

import "./styles.css";

export default function RootLayout({ children }: PropsWithChildren) {
  return (
    <div className="wrap">
      <header className="head">
        <Link href="/" className="brand">
          nlite · workers
        </Link>
        <nav className="head-nav">
          <Link href="/">Home</Link>
          <Link href="/examples">Examples</Link>
          <Link href="/users/alice">users/[id]</Link>
        </nav>
      </header>
      {children}
    </div>
  );
}
