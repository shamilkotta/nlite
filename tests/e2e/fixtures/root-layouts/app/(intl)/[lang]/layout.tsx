import type { ReactNode } from "react";

import { Nav } from "../../../components/nav";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-root="intl">
      <body>
        <Nav />
        {children}
      </body>
    </html>
  );
}
