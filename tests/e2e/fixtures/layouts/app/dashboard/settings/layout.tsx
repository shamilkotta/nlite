import type { ReactNode } from "react";

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return <article id="settings-layout">{children}</article>;
}
