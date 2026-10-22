"use client";

import { usePathname, useSearchParams } from "nlite/navigation";

export function HooksView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  return (
    <>
      <p id="pathname">{pathname}</p>
      <p id="search-q">{searchParams.get("q") ?? "none"}</p>
    </>
  );
}
