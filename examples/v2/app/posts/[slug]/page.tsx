export const rendering = "ssg";

export async function generateStaticParams() {
  return [{ slug: "hello-vite" }, { slug: "second-post" }];
}

export default function PostPage({ params }: { params: { slug: string } }) {
  return (
    <article className="stack">
      <p className="eyebrow">Dynamic route</p>
      <h1>{params.slug}</h1>
      <p>
        This route already exposes the metadata needed for static generation in a later build step.
      </p>
    </article>
  );
}
