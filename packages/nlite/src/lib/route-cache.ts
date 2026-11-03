import { createFromFetch, createFromReadableStream } from "@vitejs/plugin-rsc/browser";

import type { RscPayload } from "../types.js";
import { PARTIAL_HEADER, PREFETCH_HEADER, STALE_TIME_HEADER } from "../utils/constants.js";

export type RouteTree =
  | { partial: false; payload: Promise<RscPayload> }
  | { partial: true; payload: Promise<RscPayload> | undefined };

interface RouteCacheEntry {
  tree: Promise<RouteTree>;
  expiresAt: number;
}

const fullRoutes = new Map<string, RouteCacheEntry>();
const shellRoutes = new Map<string, RouteCacheEntry>();
const inflightFullRoutes = new Map<string, Promise<RscPayload>>();

type CreateRscHref = (url: URL) => string;

export function invalidateRouteCache() {
  fullRoutes.clear();
  shellRoutes.clear();
}

export function readRouteTree(url: URL) {
  const key = getRouteKey(url);
  return readEntry(fullRoutes, key) ?? readEntry(shellRoutes, key);
}

export function prefetchRoute(url: URL, createRscHref: CreateRscHref) {
  if (readRouteTree(url)) {
    return Promise.resolve();
  }

  const key = getRouteKey(url);
  const pending = fetchTree(url, createRscHref);
  const entry: RouteCacheEntry = {
    tree: pending.then(({ tree }) => tree),
    expiresAt: Infinity,
  };
  shellRoutes.set(key, entry);

  return pending.then(
    ({ tree, staleTimeMs }) => {
      if (shellRoutes.get(key) !== entry) return;
      entry.expiresAt = Date.now() + staleTimeMs;
      if (tree.partial) return;
      shellRoutes.delete(key);
      fullRoutes.set(key, entry);
    },
    () => {
      if (shellRoutes.get(key) === entry) shellRoutes.delete(key);
    },
  );
}

export function fetchRouteTree(url: URL, createRscHref: CreateRscHref) {
  const key = getRouteKey(url);
  const existing = inflightFullRoutes.get(key);

  if (existing) {
    return existing;
  }

  const pending = requestRoute(url, createRscHref, { prefetch: false }).then((response) => {
    const staleTimeMs = parseStaleTimeHeader(response) ?? getDefaultStaleTimeMs(false);
    const payload = createFromFetch<RscPayload>(Promise.resolve(response));

    if (staleTimeMs > 0) {
      fullRoutes.set(key, {
        tree: Promise.resolve({ partial: false, payload }),
        expiresAt: Date.now() + staleTimeMs,
      });
    }

    return payload;
  });

  inflightFullRoutes.set(key, pending);

  return pending.finally(() => {
    inflightFullRoutes.delete(key);
  });
}

async function fetchTree(url: URL, createRscHref: CreateRscHref) {
  const response = await requestRoute(url, createRscHref, { prefetch: true });
  const staleTimeMs = parseStaleTimeHeader(response) ?? getDefaultStaleTimeMs(true);
  const tree: RouteTree =
    response.headers.get(PARTIAL_HEADER) === "1"
      ? { partial: true, payload: readShellPayload(response) }
      : { partial: false, payload: createFromFetch<RscPayload>(Promise.resolve(response)) };

  return { tree, staleTimeMs };
}

function requestRoute(url: URL, createRscHref: CreateRscHref, options: { prefetch: boolean }) {
  return fetch(createRscHref(url), {
    redirect: "manual",
    headers: options.prefetch ? { [PREFETCH_HEADER]: "1" } : undefined,
  });
}

function readShellPayload(response: Response) {
  if (response.status === 204 || !response.body) {
    return;
  }

  return createFromReadableStream<RscPayload>(keepHolesPending(response.body));
}

function keepHolesPending(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader();

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        return new Promise<void>(() => {});
      }
      controller.enqueue(value);
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });
}

function readEntry(cache: Map<string, RouteCacheEntry>, key: string) {
  const entry = cache.get(key);

  if (!entry) {
    return;
  }

  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return;
  }

  return entry.tree;
}

function getRouteKey(url: URL) {
  return `${url.pathname}${url.search}`;
}

function getDefaultStaleTimeMs(prefetch: boolean) {
  const times = __NLITE_STALE_TIMES__;
  return (prefetch ? times.static : times.dynamic) * 1000;
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
