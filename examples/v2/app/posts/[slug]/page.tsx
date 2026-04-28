// export const rendering = "ssg";

export async function generateStaticParams() {
  return [{ slug: "hello-vite" }, { slug: "second-post" }];
}

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const data = await new Promise<string>((resolve) =>
    setTimeout(() => resolve("new Data name"), 3000),
  );
  const { slug } = await params;

  return (
    <article className="stack">
      <p className="eyebrow">Dynamic route</p>
      <h1>
        {slug} {data}
      </h1>
      <p>
        This route already exposes the metadata needed for static generation in a later build step.
      </p>
    </article>
  );
}
