import type { Metadata } from "nlite";

export const metadata: Metadata = {
  title: "About",
  description: "About us",
  keywords: ["nlite", "e2e"],
  robots: { index: false, follow: true },
  alternates: { canonical: "https://example.com/about" },
  openGraph: { title: "About OG", images: [{ url: "https://example.com/og.png", alt: "OG image" }] },
  twitter: { card: "summary_large_image", site: "@nlite" },
};

export default function Page() {
  return <h1>About</h1>;
}
