import { createFromFetch } from "@vitejs/plugin-rsc/browser";

import type { RscPayload } from "../types.js";
import { STALE_TIME_HEADER } from "../utils/constants.js";

interface RouteCacheEntry {
  payload: RscPayload;
  fetchedAt: number;
  staleTimeMs: number;
}

interface ShellCacheEntry {
  /** null when the route has nothing to prefetch (dynamic without a loading boundary) */
  payload: RscPayload | null;
  fetchedAt: number;
  staleTimeMs: number;
}

// Full payloads, used as-is on navigation
const routeCache = new Map<string, RouteCacheEntry>();
// Partial prefetch shells, rendered instantly while the full payload is fetched
const shellCache = new Map<string, ShellCacheEntry>();
const inflightFetches = new Map<string, Promise<RscPayload>>();
const inflightPrefetches = new Map<string, Promise<void>>();

function getRouteKey(url: URL) {
  return `${url.pathname}${url.search}`;
}

function getDefaultStaleTimeMs(kind: "static" | "dynamic") {
  const times = __NLITE_STALE_TIMES__;
  const seconds = kind === "static" ? times.static : times.dynamic;
  return seconds * 1000;
}

function isFresh(entry: { fetchedAt: number; staleTimeMs: number }) {
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
  shellCache.clear();
}

/** Fresh prefetch shell for the URL, if one was prefetched */
export function getPrefetchShell(url: URL) {
  const entry = shellCache.get(getRouteKey(url));
  return entry && isFresh(entry) ? entry.payload : null;
}

/**
 * Fetches the prefetch payload. A complete payload (static routes) lands in the route cache and
 * is used directly on navigation; a partial one (PPR static shell or loading-boundary shell) is
 * kept as a shell to render instantly while the full payload streams in.
 */
export function prefetchRoute(url: URL, createPrefetchHref: (url: URL) => string) {
  const key = getRouteKey(url);
  const cached = routeCache.get(key);
  const shell = shellCache.get(key);

  if ((cached && isFresh(cached)) || (shell && isFresh(shell))) {
    return Promise.resolve();
  }

  const existing = inflightPrefetches.get(key);
  if (existing) {
    return existing;
  }

  const pending = (async () => {
    const response = await fetch(createPrefetchHref(url), { redirect: "manual" });
    const staleTimeMs = parseStaleTimeHeader(response) ?? getDefaultStaleTimeMs("static");

    if (response.status === 204 || !response.ok || !response.body) {
      shellCache.set(key, { payload: null, fetchedAt: Date.now(), staleTimeMs });
      return;
    }

    // Partial shells contain holes that are never filled; keeping the stream open stops the
    // flight client from erroring them as "Connection closed" once the body ends
    const payload = (await createFromFetch(
      Promise.resolve(new Response(keepOpen(response.body), { headers: response.headers })),
    )) as RscPayload;

    if (payload.partial) {
      shellCache.set(key, { payload, fetchedAt: Date.now(), staleTimeMs });
    } else {
      routeCache.set(key, { payload, fetchedAt: Date.now(), staleTimeMs });
    }
  })().catch(() => undefined);

  inflightPrefetches.set(key, pending);

  return pending.finally(() => {
    inflightPrefetches.delete(key);
  });
}

function keepOpen(body: ReadableStream<Uint8Array>) {
  const reader = body.getReader();
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        // Never resolves: the stream stays open without closing
        return new Promise<void>(() => {});
      }
      controller.enqueue(value);
    },
  });
}

export function hasFreshRoute(url: URL) {
  const cached = routeCache.get(getRouteKey(url));
  return Boolean(cached && isFresh(cached));
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
    const response = await fetch(createRscHref(url), { redirect: "manual" });
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
