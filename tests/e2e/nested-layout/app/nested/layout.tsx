import type { PropsWithChildren } from "react";

export default function NestedLayout({ children }: PropsWithChildren) {
  return (
    <section data-testid="nested-layout">
      <p data-testid="nested-layout-label">nested-layout</p>
      {children}
    </section>
  );
}
