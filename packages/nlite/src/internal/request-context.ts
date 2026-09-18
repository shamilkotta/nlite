import { AsyncLocalStorage } from "node:async_hooks";
import { CacheSignal, PrerenderCache } from "./prerender-cache.js";

type DynamicReason = "headers" | "cookies" | "searchParams" | "fetch";

interface RequestContext {
  request: Request;
  searchParams: URLSearchParams;
  signal?: AbortSignal;
  onDynamicUsage?: (reason: DynamicReason) => void;
  deferDynamic?: boolean;
  cache: PrerenderCache;
  cacheSignal?: CacheSignal;
}

export class DynamicPrerenderUsageError extends Error {
  name = "DynamicPrerenderUsageError" as const;
  constructor() {
    super("Route used request-bound data during prerender");
  }

  static isInstance(error: unknown): error is DynamicPrerenderUsageError {
    return (
      error instanceof DynamicPrerenderUsageError ||
      (error instanceof Error && error.name === "DynamicPrerenderUsageError")
    );
  }
}

const requestContext = new AsyncLocalStorage<RequestContext>();

export function runWithRequestContext<T>(
  request: Request,
  callback: () => T,
  options: {
    searchParams?: URLSearchParams;
    signal?: AbortSignal;
    onDynamicUsage?: (reason: DynamicReason) => void;
    deferDynamic?: boolean;
    cache?: PrerenderCache;
    cacheSignal?: CacheSignal;
  } = {},
) {
  const url = new URL(request.url);
  const store: RequestContext = {
    request,
    searchParams: options.searchParams ?? url.searchParams,
    signal: options.signal,
    onDynamicUsage: options.onDynamicUsage,
    deferDynamic: options.deferDynamic,
    cache: options.cache ?? new PrerenderCache(),
    cacheSignal: options.cacheSignal,
  };

  return requestContext.run(store, () => withContextFetch(callback, store));
}

function markDynamicUsage(reason: DynamicReason): Promise<void> {
  const store = requestContext.getStore();
  store?.onDynamicUsage?.(reason);

  if (store?.deferDynamic || store?.signal?.aborted) {
    return new Promise((_, reject) => {
      if (store.signal?.aborted) {
        reject(store.signal.reason);
        return;
      }

      store.signal?.addEventListener("abort", () => reject(store.signal?.reason), { once: true });
    });
  }

  return Promise.resolve();
}

export async function headers() {
  const context = getRequestContext("headers");
  await markDynamicUsage("headers");
  return context.request.headers;
}

export async function cookies() {
  const context = getRequestContext("cookies");
  await markDynamicUsage("cookies");
  return parseCookies(context.request.headers.get("cookie"));
}

export function trackSearchParams<T extends URLSearchParams>(value: T): Promise<T> {
  return {
    // oxlint-disable-next-line no-thenable
    then(onFulfilled, onRejected) {
      return markDynamicUsage("searchParams").then(() =>
        Promise.resolve(value).then(onFulfilled, onRejected),
      );
    },
    catch(onRejected) {
      return Promise.resolve(value).catch(onRejected);
    },
    finally(onFinally) {
      return Promise.resolve(value).finally(onFinally);
    },
    [Symbol.toStringTag]: "Promise",
  };
}

export function createCachedFunction<Args extends readonly unknown[], Result>(
  functionId: string,
  fn: (...args: Args) => Result,
) {
  return (...args: Args) => {
    const context = getRequestContext("cache");
    return context.cache.data(functionId, args, () => fn(...args), context.cacheSignal);
  };
}

function withContextFetch<T>(callback: () => T, context: RequestContext) {
  const originalFetch = globalThis.fetch;
  let restoreImmediately = true;

  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    if (!isDynamicFetch(input, init)) {
      return context.cache.fetch(input, init, originalFetch, context.cacheSignal);
    }

    return markDynamicUsage("fetch").then(() => originalFetch(input, init));
  }) as typeof fetch;

  try {
    const result = callback();

    if (result && typeof result === "object" && "finally" in result) {
      restoreImmediately = false;
      return (result as unknown as Promise<Awaited<T>>).finally(() => {
        globalThis.fetch = originalFetch;
      }) as T;
    }

    return result;
  } finally {
    if (restoreImmediately) {
      globalThis.fetch = originalFetch;
    }
  }
}

function getRequestContext(apiName: string) {
  const context = requestContext.getStore();

  if (!context) {
    throw new Error(`${apiName}() can only be used while rendering an nlite request`);
  }

  return context;
}

function parseCookies(header: string | null) {
  const store = new Map<string, string>();

  if (header) {
    for (const part of header.split(";")) {
      const [rawName, ...rawValue] = part.trim().split("=");
      if (!rawName) continue;
      store.set(decodeURIComponent(rawName), decodeURIComponent(rawValue.join("=")));
    }
  }

  return {
    get(name: string) {
      const value = store.get(name);
      return value === undefined ? undefined : { name, value };
    },
    getAll(name?: string) {
      const entries = name === undefined ? store.entries() : [[name, store.get(name)] as const];

      return [...entries]
        .filter((entry): entry is [string, string] => entry[1] !== undefined)
        .map(([cookieName, value]) => ({ name: cookieName, value }));
    },
    has(name: string) {
      return store.has(name);
    },
  };
}

function isDynamicFetch(input: RequestInfo | URL, init?: RequestInit) {
  const cache = init?.cache ?? (input instanceof Request ? input.cache : undefined);

  return cache !== "force-cache" && cache !== "only-if-cached";
}
