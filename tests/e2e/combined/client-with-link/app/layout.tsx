import type { PropsWithChildren } from "react";
import Link from "nlite/link";

export default function RootLayout({ children }: PropsWithChildren) {
  return (
    <div data-testid="root-layout">
      <Link href="/" data-testid="nav-home">
        Home
      </Link>
      <Link href="/client" data-testid="nav-client">
        Client
      </Link>
      {children}
    </div>
  );
}
