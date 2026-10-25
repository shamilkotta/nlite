import type { ReactNode } from "react";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div id="root-layout">
          <header id="root-header">Site header</header>
          {children}
        </div>
      </body>
    </html>
  );
}
