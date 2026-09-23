import type { PropsWithChildren } from "react";

export default function RootLayout({ children }: PropsWithChildren) {
  return <div data-testid="root-layout">{children}</div>;
}
