import type { StaleTimes } from "../types.js";

export const FILE_EXTENSIONS = ["tsx", "ts", "jsx", "js"];
export const PRERENDER_ORIGIN = "http://nlite.local";
export const NOT_FOUND_HTML_FILE = "_not-found.html";
export const NOT_FOUND_RSC_FILE = "_not-found.rsc";
export const NOT_FOUND_ROUTE_PATH = "/_not-found";

export const STALE_TIME_HEADER = "x-nlite-staletime";
export const RESPONSE_STATUS_HEADER = "x-nlite-status";
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

export const STYLE_CLASS = "_nlite_status_";
