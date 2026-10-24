import Link from "nlite/link";

export default function Page() {
  return (
    <main>
      <h1 id="home">Home</h1>
      <Link id="to-static" href="/static">
        static
      </Link>
      <Link id="to-redirect" href="/static-redirect">
        redirect
      </Link>
    </main>
  );
}
