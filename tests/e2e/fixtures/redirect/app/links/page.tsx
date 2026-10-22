import Link from "nlite/link";

export default function Page() {
  return (
    <nav>
      <Link id="to-dynamic" href="/dynamic" prefetch={false}>
        dynamic
      </Link>
      <Link id="to-static" href="/static" prefetch={false}>
        static
      </Link>
    </nav>
  );
}
