import type { Metadata } from "nlite";

export const metadata: Metadata = { title: "About" };

export default function Page() {
  return (
    <main>
      <h1>About</h1>
      <p className="muted">Prerendered at build time. The (marketing) folder is not in the URL.</p>
    </main>
  );
}
