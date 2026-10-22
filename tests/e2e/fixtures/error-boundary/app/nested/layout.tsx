import type { ReactNode } from "react";

export default function NestedLayout({ children }: { children: ReactNode }) {
  return (
    <section>
      <p id="nested-layout">Nested layout survives</p>
      {children}
    </section>
  );
}
