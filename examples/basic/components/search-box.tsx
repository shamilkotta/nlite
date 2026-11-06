"use client";

import { useRouter, useSearchParams } from "nlite/navigation";

export function SearchBox() {
  const router = useRouter();
  const searchParams = useSearchParams();

  return (
    <input
      type="search"
      placeholder="Search posts"
      defaultValue={searchParams.get("q") ?? ""}
      onChange={(event) => router.replace(`/search?q=${encodeURIComponent(event.target.value)}`)}
    />
  );
}
