import Link from "nlite/link";

export default function Page() {
  return (
    <main>
      <h1 id="page-home">Home</h1>
      <Link id="link-a" href="/a">
        a (prefetch on viewport)
      </Link>
      <Link id="link-b" href="/b" prefetch={false}>
        b (no prefetch)
      </Link>
      <Link id="link-c" href="/c" prefetch="hover">
        c (prefetch on hover)
      </Link>
      <Link id="link-a-replace" href="/a" replace prefetch={false}>
        a (replace)
      </Link>
      <Link id="link-blank" href="/b" target="_blank">
        b in a new tab
      </Link>
      <Link id="link-external-rel" href="/b" rel="external">
        b with rel=external
      </Link>
      <Link id="link-download" href="/b" download>
        b as download
      </Link>
      <Link id="link-dynamic" href="/dynamic" prefetch={false}>
        dynamic
      </Link>
      <Link id="link-query" href="/a?tab=details" prefetch={false}>
        a with query
      </Link>
      <Link id="link-missing" href="/does-not-exist" prefetch={false}>
        missing
      </Link>
      <Link id="link-hash" href="#section" prefetch={false}>
        hash
      </Link>
      <p id="section">Section</p>
    </main>
  );
}
