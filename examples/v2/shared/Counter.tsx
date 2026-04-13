"use client";

import { useState } from "react";
import Link from "nlite/link";
import { usePathname, useRouter } from "nlite/navigation";

export default function Counter() {
  const [count, setCount] = useState(0);
  const pathname = usePathname();
  const router = useRouter();

  return (
    <>
      <p>Current pathname: {pathname}</p>
      <button
        className="counter"
        onClick={() => setCount((value) => value + 1)}>
        Count: {count}
      </button>
      <button className="counter" onClick={() => router.push("/about")}>
        Push to about
      </button>
      <Link className="counter" href="/posts/second-post">
        Prefetched post link
      </Link>
    </>
  );
}

export const SmallCounter = () => {
  const [count, setCount] = useState(0);
  return (
    <button className="counter" onClick={() => setCount((value) => value + 1)}>
      Count Small: {count}
    </button>
  );
};
