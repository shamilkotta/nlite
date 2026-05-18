export type Doc = {
  slug: string;
  title: string;
  summary: string;
};

export const docs: Doc[] = [
  {
    slug: "routing",
    title: "File-based routing",
    summary: "Routes are discovered from the app directory using page.tsx conventions.",
  },
  {
    slug: "rendering",
    title: "Rendering modes",
    summary: "Control static generation and SSR with rendering exports on each page.",
  },
  {
    slug: "static-params",
    title: "generateStaticParams",
    summary: "Pre-render dynamic segments at build time by returning param objects.",
  },
];

export function getDoc(slug: string) {
  return docs.find((doc) => doc.slug === slug);
}

export function formatTime(date = new Date()) {
  return date.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "medium",
  });
}
