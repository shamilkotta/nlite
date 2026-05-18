export type ShowcaseRoute = {
  href: string;
  title: string;
  description: string;
  badge: string;
};

export const showcaseRoutes: ShowcaseRoute[] = [
  {
    href: "/",
    title: "Home",
    description: "Static landing page with client-side interactivity.",
    badge: "Static",
  },
  {
    href: "/rendering/auto",
    title: "Auto static",
    description: "No rendering export — prerendered when the tree is static.",
    badge: "Auto SSG",
  },
  {
    href: "/rendering/force-ssg",
    title: "force-ssg",
    description: "Always emitted as HTML and RSC at build time.",
    badge: "force-ssg",
  },
  {
    href: "/rendering/force-ssr",
    title: "force-ssr",
    description: "Skipped at build time; rendered on each request.",
    badge: "force-ssr",
  },
  {
    href: "/docs/routing",
    title: "Docs (dynamic)",
    description: "Dynamic segment with generateStaticParams.",
    badge: "SSG + params",
  },
  {
    href: "/users/42",
    title: "Users (dynamic)",
    description: "Runtime-only dynamic route without static params.",
    badge: "SSR",
  },
  {
    href: "/explorer/guides/setup/install",
    title: "Catch-all",
    description: "Captures arbitrary path segments after /explorer/.",
    badge: "[...path]",
  },
  {
    href: "/demo/suspense",
    title: "Suspense",
    description: "Nested loading.tsx boundary around a slow server component.",
    badge: "loading.tsx",
  },
  {
    href: "/demo/error",
    title: "Error boundary",
    description: "Segment error.tsx catches client-triggered failures.",
    badge: "error.tsx",
  },
];
