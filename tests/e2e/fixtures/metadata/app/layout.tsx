import type { Metadata } from "nlite";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: { default: "Site", template: "%s | Site" },
  description: "Site description",
  openGraph: { siteName: "E2E Site", type: "website" },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div id="root-layout">{children}</div>
      </body>
    </html>
  );
}
