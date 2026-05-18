import type { PropsWithChildren } from "react";

export default function DocsLayout({ children }: PropsWithChildren) {
  return (
    <section className="segment-layout">
      <header>
        <p>Nested layout for the docs segment</p>
      </header>
      {children}
    </section>
  );
}
