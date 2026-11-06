import Link from "nlite/link";

export default function Page() {
  return (
    <main>
      <h1>nlite basics</h1>
      <ul>
        <li>
          <Link href="/about">Route group</Link>
        </li>
        <li>
          <Link href="/posts">Nested layout and static params</Link>
        </li>
        <li>
          <Link href="/posts/missing">Not found</Link>
        </li>
        <li>
          <Link href="/docs/guides/routing">Catch-all route</Link>
        </li>
        <li>
          <Link href="/slow">Loading UI</Link>
        </li>
        <li>
          <Link href="/time">Server rendering</Link>
        </li>
        <li>
          <Link href="/search?q=hello">Search params</Link>
        </li>
        <li>
          <Link href="/old-about">Redirect</Link>
        </li>
        <li>
          <Link href="/broken">Error UI</Link>
        </li>
        <li>
          <a href="/api/hello">Route handler</a>
        </li>
      </ul>
    </main>
  );
}
