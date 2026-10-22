import type { ReactNode } from "react";

export default async function TeamLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ team: string }>;
}) {
  const { team } = await params;
  return (
    <section id="team-layout">
      <p id="layout-team">{team}</p>
      {children}
    </section>
  );
}
