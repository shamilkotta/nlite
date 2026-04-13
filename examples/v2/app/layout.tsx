import type { PropsWithChildren } from "react";
import Link from "nlite/link";

import "./styles.css";
import { SmallCounter } from "../shared/Counter";

export default function RootLayout({ children }: PropsWithChildren) {
  return (
    <main className="shell">
      <header className="header">
        <Link href="/">nlite v2</Link>
        <nav>
          <Link href="/about">About</Link>
          <Link href="/posts/hello-vite">Post</Link>
        </nav>
        <SmallCounter />
      </header>
      {children}
    </main>
  );
}
