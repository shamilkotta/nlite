import Link from "nlite/link";

export async function generateStaticParams() {
  return [{ slug: "alpha" }, { slug: "beta" }];
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  return (
    <main className="main">
      <h1>SSG · [slug]</h1>
      <p className="muted">
        <code>generateStaticParams</code> — prebuilt paths at build (<code>alpha</code>, <code>beta</code>).
      </p>
      <pre className="block">{JSON.stringify({ slug }, null, 2)}</pre>
      <p>
        <Link href="/examples/ssg/beta">Other slug</Link>
        {" · "}
        <Link href="/examples">← Examples</Link>
      </p>
    </main>
  );
}
