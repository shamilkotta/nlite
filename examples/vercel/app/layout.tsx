import type { PropsWithChildren } from "react";
import Link from "nlite/link";

import "./styles.css";

export default function RootLayout({ children }: PropsWithChildren) {
  return (
    <div className="wrap">
      <nav className="head">
        <Link href="/">Home</Link>
        <Link href="/about">About</Link>
      </nav>
      {children}
    </div>
  );
}
