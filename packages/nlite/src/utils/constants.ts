import type { StaleTimes } from "../types.js";

export const FILE_EXTENSIONS = ["tsx", "ts", "jsx", "js"];
export const PRERENDER_ORIGIN = "http://nlite.local";
export const NOT_FOUND_HTML = "<!doctype html><title>404</title><h1>Not Found</h1>\n";
export const STALE_TIME_HEADER = "x-nlite-staletime";
export const RSC_POSTFIX = ".rsc";

const DEFAULT_STALE_TIMES = {
  static: 300,
  dynamic: 0,
} as const;

export function resolveStaleTimes(staleTimes?: StaleTimes) {
  return {
    static: staleTimes?.static ?? DEFAULT_STALE_TIMES.static,
    dynamic: staleTimes?.dynamic ?? DEFAULT_STALE_TIMES.dynamic,
  };
}
