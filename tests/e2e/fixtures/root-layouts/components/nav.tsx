"use client";

import Link from "nlite/link";
import { useRouter } from "nlite/navigation";

export function Nav() {
  const router = useRouter();
  return (
    <nav>
      <Link id="link-home" href="/" prefetch={false}>
        home
      </Link>
      <Link id="link-about" href="/about" prefetch={false}>
        about
      </Link>
      <Link id="link-shop" href="/shop" prefetch={false}>
        shop
      </Link>
      <Link id="link-en" href="/en" prefetch={false}>
        en
      </Link>
      <Link id="link-fr" href="/fr" prefetch={false}>
        fr
      </Link>
      <Link id="link-missing" href="/missing/page" prefetch={false}>
        missing
      </Link>
      <button id="replace-shop" type="button" onClick={() => router.replace("/shop")}>
        replace /shop
      </button>
    </nav>
  );
}
