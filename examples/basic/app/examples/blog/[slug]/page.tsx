import type { Metadata } from "nlite";
import Link from "nlite/link";
import { getCollection, getEntry } from "nlite/mdx";
import { notFound } from "nlite/navigation";

type BlogPostData = {
  title: string;
  description: string;
  publishedAt: Date;
  tags: string[];
  draft: boolean;
};

export async function generateStaticParams() {
  const posts = await getCollection<BlogPostData>("blog");
  return posts.filter((post) => !post.data.draft).map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getEntry<BlogPostData>("blog", slug);

  if (!post || post.data.draft) {
    return {
      title: "Post not found",
      robots: { index: false, follow: false },
    };
  }

  return {
    title: post.data.title,
    description: post.data.description,
    openGraph: {
      title: post.data.title,
      description: post.data.description,
    },
  };
}

export default async function ContentBlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getEntry<BlogPostData>("blog", slug);

  if (!post || post.data.draft) {
    notFound();
  }

  const PostContent = post.Content;

  return (
    <main className="main">
      <h1>{post.data.title}</h1>
      <p className="muted">{post.data.description}</p>
      <p className="muted">
        Published at {post.data.publishedAt.toISOString().slice(0, 10)} • Tags:{" "}
        {post.data.tags.join(", ") || "none"}
      </p>
      <article>
        <PostContent />
      </article>
      <p>
        <Link href="/examples/blog">← Back to blog index</Link>
      </p>
    </main>
  );
}
