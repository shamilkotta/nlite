import Link from "nlite/link";
import { getCollection, getEntry } from "nlite/mdx";

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

export default async function ContentBlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getEntry<BlogPostData>("blog", slug);

  if (!post || post.data.draft) {
    return (
      <main className="main">
        <h1>Post not found</h1>
        <p>
          <Link href="/examples/blog">← Back to blog index</Link>
        </p>
      </main>
    );
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
