import type { PropsWithChildren } from "react";

export default function PostsLayout({ children }: PropsWithChildren) {
  return (
    <section>
      <p className="muted">Posts layout</p>
      {children}
    </section>
  );
}
