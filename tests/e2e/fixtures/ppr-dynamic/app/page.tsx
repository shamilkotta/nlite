import Link from "nlite/link";

export default function Page() {
  return (
    <main>
      <h1 id="home">Home</h1>
      <Link id="to-cookies-redirect" href="/cookies-redirect" prefetch={false}>
        cookies redirect
      </Link>
      <Link id="to-cookies-not-found" href="/cookies-not-found" prefetch={false}>
        cookies not found
      </Link>
      <Link id="to-guarded" href="/guarded" prefetch={false}>
        guarded
      </Link>
    </main>
  );
}
