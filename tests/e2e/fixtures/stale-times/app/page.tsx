import Link from "nlite/link";

export default function Page() {
  return (
    <main>
      <h1 id="home">Home</h1>
      <Link id="to-dynamic" href="/dynamic" prefetch={false}>
        dynamic
      </Link>
      <Link id="to-static" href="/static" prefetch={false}>
        static
      </Link>
    </main>
  );
}
