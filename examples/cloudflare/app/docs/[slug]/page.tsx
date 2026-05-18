import Link from "nlite/link";

import { PageHeader } from "../../../components/PageHeader";
import { docs, formatTime, getDoc } from "../../../lib/content";

export async function generateStaticParams() {
  return docs.map((doc) => ({ slug: doc.slug }));
}

export default async function DocPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const doc = getDoc(slug);

  if (!doc) {
    return (
      <section className="stack">
        <PageHeader
          eyebrow="Not found"
          title="Unknown document"
          description={`No article exists for slug "${slug}".`}
        />
        <Link className="button button-ghost" href="/docs">
          Back to docs
        </Link>
      </section>
    );
  }

  return (
    <article className="stack">
      <PageHeader
        eyebrow="Article"
        title={doc.title}
        description={doc.summary}
        badge="SSG"
      />
      <div className="panel">
        <p className="meta">Slug: {slug}</p>
        <p>Pre-rendered at build: {formatTime()}</p>
      </div>
      <Link className="button button-ghost" href="/docs">
        All docs
      </Link>
    </article>
  );
}
