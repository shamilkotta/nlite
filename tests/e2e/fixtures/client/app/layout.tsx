import type { ReactNode } from "react";

import "./styles.css";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div id="root-layout">{children}</div>
      </body>
    </html>
  );
}
