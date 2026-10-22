"use client";

import { useRouter } from "nlite/navigation";

export function RouterButtons() {
  const router = useRouter();
  return (
    <div>
      <button id="push-a" type="button" onClick={() => router.push("/a")}>
        push /a
      </button>
      <button id="replace-b" type="button" onClick={() => router.replace("/b")}>
        replace /b
      </button>
      <button id="refresh" type="button" onClick={() => router.refresh()}>
        refresh
      </button>
      <button id="back" type="button" onClick={() => router.back()}>
        back
      </button>
      <button id="prefetch-c" type="button" onClick={() => void router.prefetch("/c")}>
        prefetch /c
      </button>
    </div>
  );
}
