import type { PropsWithChildren } from "react";
import Link from "nlite/link";

export default function RenderingLayout({ children }: PropsWithChildren) {
  return (
    <section className="segment-layout">
      <header>
        <p>Rendering modes</p>
        <nav className="site-nav">
          <Link href="/rendering/auto">Auto</Link>
          <Link href="/rendering/force-ssg">force-ssg</Link>
          <Link href="/rendering/force-ssr">force-ssr</Link>
        </nav>
      </header>
      {children}
    </section>
  );
}
