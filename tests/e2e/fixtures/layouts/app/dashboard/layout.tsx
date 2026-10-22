import type { ReactNode } from "react";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <section id="dashboard-layout">
      <nav id="dashboard-nav">Dashboard nav</nav>
      {children}
    </section>
  );
}
