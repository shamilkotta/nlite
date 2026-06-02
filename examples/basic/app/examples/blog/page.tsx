import Link from "nlite/link";
import { getCollection } from "nlite/mdx";

type BlogPostData = {
  title: string;
  description: string;
  publishedAt: Date;
  tags: string[];
  draft: boolean;
};

export default async function ContentBlogIndexPage() {
  const posts = await getCollection<BlogPostData>("blog");
  const visiblePosts = posts
    .filter((post) => !post.data.draft)
    .sort((left, right) => right.data.publishedAt.getTime() - left.data.publishedAt.getTime());

  return (
    <main className="main">
      <h1>Content blog</h1>
      <p className="muted">
        Entries are loaded from <code>content/blog/*</code> through <code>getCollection</code>.
      </p>
      <ul className="link-list">
        {visiblePosts.map((post) => (
          <li key={post.id}>
            <Link href={`/examples/blog/${post.slug}`}>{post.data.title}</Link>
            <span className="muted"> — {post.data.description}</span>
          </li>
        ))}
      </ul>
      <p>
        <Link href="/examples">← Examples</Link>
      </p>
    </main>
  );
}
