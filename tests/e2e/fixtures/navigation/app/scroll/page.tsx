import Link from "nlite/link";

export default function Page() {
  return (
    <main>
      <h1 id="page-scroll">Scroll</h1>
      <div style={{ height: "3000px" }} />
      <Link id="scroll-to-a" href="/a" prefetch={false}>
        a (scroll to top)
      </Link>
      <Link id="keep-scroll-to-b" href="/b" scroll={false} prefetch={false}>
        b (keep scroll)
      </Link>
      <Link id="keep-scroll-to-tall" href="/tall" scroll={false} prefetch={false}>
        tall (keep scroll)
      </Link>
    </main>
  );
}
