"use client";

import { useState } from "react";
import Link from "nlite/link";
import { usePathname, useRouter } from "nlite/navigation";

export function Counter() {
  const [count, setCount] = useState(0);
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className="counter-panel">
      <p className="meta">Pathname: {pathname}</p>
      <div className="button-row">
        <button className="button" type="button" onClick={() => setCount((value) => value + 1)}>
          Count {count}
        </button>
        <button className="button button-ghost" type="button" onClick={() => router.push("/docs/routing")}>
          Navigate
        </button>
        <Link className="button button-ghost" href="/rendering/force-ssr">
          Prefetch SSR route
        </Link>
      </div>
    </div>
  );
}
