import { PropsWithChildren } from "react";

export default function AboutLayout({ children }: PropsWithChildren) {
  return (
    <section className="stack">
      <h1>About Layout</h1>
      {children}
    </section>
  );
}
