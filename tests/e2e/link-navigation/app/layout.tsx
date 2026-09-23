import type { PropsWithChildren } from "react";
import Link from "nlite/link";

export default function RootLayout({ children }: PropsWithChildren) {
  return (
    <div data-testid="root-layout">
      <nav>
        <Link href="/" data-testid="nav-home">
          Home
        </Link>
        <Link href="/about" data-testid="nav-about">
          About
        </Link>
      </nav>
      {children}
    </div>
  );
}
