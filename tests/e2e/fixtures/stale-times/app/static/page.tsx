import Link from "nlite/link";

export default function Page() {
  return (
    <main>
      <h1 id="static">Static</h1>
      <Link id="to-home" href="/" prefetch={false}>
        home
      </Link>
    </main>
  );
}
