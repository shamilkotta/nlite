"use client";

import { usePathname, useSearchParams } from "nlite/navigation";

export function Location() {
  return (
    <>
      <p id="pathname">{usePathname()}</p>
      <p id="search-q">{useSearchParams().get("q")}</p>
    </>
  );
}
