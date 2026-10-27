"use client";

import { use } from "react";

const never = new Promise<never>(() => {});

/**
 * Stands in for everything below the deepest loading boundary in a prefetch shell. It suspends
 * forever, so the boundary shows its loading UI until the full payload replaces it.
 */
export function PrefetchHole(): never {
  return use(never);
}
