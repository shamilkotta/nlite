import { PropsWithChildren } from "react";

export default function AboutLayout({ children }: PropsWithChildren) {
  return (
    <section className="stack">
      <h1>About v2</h1>
      {children}
    </section>
  );
}
