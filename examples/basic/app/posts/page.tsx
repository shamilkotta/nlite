import type { Metadata } from "nlite";
import Link from "nlite/link";

import { posts } from "../../lib/posts";

export const metadata: Metadata = { title: "Posts" };

export default function Page() {
  return (
    <main>
      <h1>Posts</h1>
      <ul>
        {posts.map((post) => (
          <li key={post.slug}>
            <Link href={`/posts/${post.slug}`}>{post.title}</Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
