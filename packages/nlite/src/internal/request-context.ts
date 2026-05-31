import { AsyncLocalStorage } from "node:async_hooks";

type DynamicReason = "headers" | "cookies" | "searchParams" | "fetch";

interface RequestContext {
  request: Request;
  searchParams: URLSearchParams;
  onDynamicUsage?: (reason: DynamicReason) => void;
}

const requestContext = new AsyncLocalStorage<RequestContext>();

export function runWithRequestContext<T>(
  request: Request,
  callback: () => T,
  options: {
    searchParams?: URLSearchParams;
    onDynamicUsage?: (reason: DynamicReason) => void;
  } = {},
) {
  const url = new URL(request.url);

  return requestContext.run(
    {
      request,
      searchParams: options.searchParams ?? url.searchParams,
      onDynamicUsage: options.onDynamicUsage,
    },
    callback,
  );
}

export function markDynamicUsage(reason: DynamicReason) {
  requestContext.getStore()?.onDynamicUsage?.(reason);
}

export async function headers() {
  const context = getRequestContext("headers");
  markDynamicUsage("headers");
  return context.request.headers;
}

export async function cookies() {
  const context = getRequestContext("cookies");
  markDynamicUsage("cookies");
  return parseCookies(context.request.headers.get("cookie"));
}

export function trackSearchParams<T extends URLSearchParams>(value: T): Promise<T> {
  return {
    // oxlint-disable-next-line no-thenable
    then(onFulfilled, onRejected) {
      markDynamicUsage("searchParams");
      return Promise.resolve(value).then(onFulfilled, onRejected);
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

export function withTrackedFetch<T>(callback: () => T) {
  const originalFetch = globalThis.fetch;
  let restoreImmediately = true;

  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    if (isDynamicFetch(input, init)) {
      markDynamicUsage("fetch");
    }

    return originalFetch(input, init);
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

  // TODO: other cache options (eg: no-cache, force-cache)
  return cache === undefined || cache === "no-store" || cache === "reload";
}
