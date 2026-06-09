import type { Metadata } from "nlite";
import type { PropsWithChildren } from "react";
import Link from "nlite/link";

import "./styles.css";

export const metadata: Metadata = {
  title: {
    default: "nlite basic",
    template: "%s · nlite basic",
  },
  description: "Experimental React 19 framework examples",
};

export default function RootLayout({ children }: PropsWithChildren) {
  return (
    <div className="wrap">
      <header className="head">
        <Link href="/" className="brand">
          nlite · basic
        </Link>
        <nav className="head-nav">
          <Link href="/">Home</Link>
          <Link href="/examples">Examples</Link>
          <Link href="/examples/blog">blog</Link>
        </nav>
      </header>
      {children}
    </div>
  );
}
