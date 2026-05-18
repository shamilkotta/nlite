import Link from "nlite/link";

import { PageHeader } from "../../components/PageHeader";
import { docs } from "../../lib/content";

export default function DocsIndexPage() {
  return (
    <section className="stack">
      <PageHeader
        eyebrow="Dynamic routes"
        title="Documentation"
        description="Each article is a dynamic segment pre-rendered via generateStaticParams."
        badge="generateStaticParams"
      />
      <ul className="doc-list">
        {docs.map((doc) => (
          <li key={doc.slug}>
            <Link href={`/docs/${doc.slug}`}>
              <span>{doc.title}</span>
              <span className="meta">/docs/{doc.slug}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
