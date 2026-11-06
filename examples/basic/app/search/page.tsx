import Link from "nlite/link";

import { SearchBox } from "../../components/search-box";
import { posts } from "../../lib/posts";

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const results = posts.filter((post) => post.title.toLowerCase().includes(q.toLowerCase()));

  return (
    <main>
      <h1>Search</h1>
      <SearchBox />
      <ul>
        {results.map((post) => (
          <li key={post.slug}>
            <Link href={`/posts/${post.slug}`}>{post.title}</Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
