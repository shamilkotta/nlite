import type { Metadata } from "nlite";
import type { ReactNode } from "react";

export const metadata: Metadata = { title: { default: "Section", template: "%s · Section" } };

export default function SectionLayout({ children }: { children: ReactNode }) {
  return <section>{children}</section>;
}
