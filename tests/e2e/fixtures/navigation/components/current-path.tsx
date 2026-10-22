"use client";

import { usePathname, useSearchParams } from "nlite/navigation";

export function CurrentPath() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  return <p id="current-path">{pathname + (search ? `?${search}` : "")}</p>;
}
