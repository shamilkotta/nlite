import { createFromFetch } from "@vitejs/plugin-rsc/browser";

import type { RscPayload } from "../types.js";
import { STALE_TIME_HEADER } from "../utils/constants.js";

interface RouteCacheEntry {
  payload: RscPayload;
  fetchedAt: number;
  staleTimeMs: number;
}

const routeCache = new Map<string, RouteCacheEntry>();
const inflightFetches = new Map<string, Promise<RscPayload>>();
const prefetchedRoutes = new Set<string>();

function getRouteKey(url: URL) {
  return `${url.pathname}${url.search}`;
}

function getDefaultStaleTimeMs(kind: "static" | "dynamic") {
  const times = __NLITE_STALE_TIMES__;
  const seconds = kind === "static" ? times.static : times.dynamic;
  return seconds * 1000;
}

function isFresh(entry: RouteCacheEntry) {
  if (entry.staleTimeMs <= 0) {
    return false;
  }

  return Date.now() - entry.fetchedAt < entry.staleTimeMs;
}

function parseStaleTimeHeader(response: Response) {
  const header = response.headers.get(STALE_TIME_HEADER);

  if (header == null) {
    return;
  }

  const seconds = Number(header);
  if (!Number.isFinite(seconds)) {
    return;
  }

  return seconds * 1000;
}

export function invalidateRouteCache() {
  routeCache.clear();
  prefetchedRoutes.clear();
}

export function prefetchRoute(url: URL, createRscHref: (url: URL) => string) {
  const key = getRouteKey(url);

  if (prefetchedRoutes.has(key)) {
    return Promise.resolve();
  }

  const cached = routeCache.get(key);

  if (cached && isFresh(cached)) {
    prefetchedRoutes.add(key);
    return Promise.resolve();
  }

  prefetchedRoutes.add(key);

  return fetchRouteTree(url, createRscHref).then(() => undefined);
}

export function fetchRouteTree(
  url: URL,
  createRscHref: (url: URL) => string,
  options: { bypassCache?: boolean } = {},
) {
  const key = getRouteKey(url);

  if (!options.bypassCache) {
    const cached = routeCache.get(key);

    if (cached && isFresh(cached)) {
      return Promise.resolve(cached.payload);
    }
  }

  const existing = inflightFetches.get(key);

  if (existing) {
    return existing;
  }

  const pending = (async () => {
    const response = await fetch(createRscHref(url));
    const staleTimeMs = parseStaleTimeHeader(response) ?? getDefaultStaleTimeMs("dynamic");
    const payload = (await createFromFetch(Promise.resolve(response))) as RscPayload;

    if (staleTimeMs > 0) {
      routeCache.set(key, {
        payload,
        fetchedAt: Date.now(),
        staleTimeMs,
      });
    }

    return payload;
  })();

  inflightFetches.set(key, pending);

  return pending.finally(() => {
    inflightFetches.delete(key);
  });
}
