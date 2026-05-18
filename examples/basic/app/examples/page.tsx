import Link from "nlite/link";

export default function Page() {
  return (
    <main className="main">
      <h1>Examples</h1>
      <ul className="link-list">
        <li>
          <Link href="/examples/auto">auto</Link>
        </li>
        <li>
          <Link href="/examples/force-ssg">force-ssg</Link>
        </li>
        <li>
          <Link href="/examples/force-ssr">force-ssr</Link>
        </li>
        <li>
          <Link href="/examples/ssg/alpha">ssg/[slug]</Link>
        </li>
        <li>
          <Link href="/examples/server-fetch">server-fetch</Link>
        </li>
      </ul>
      <p>
        <Link href="/">← Home</Link>
      </p>
    </main>
  );
}
