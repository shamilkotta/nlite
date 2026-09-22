export interface SerializedFetchCacheEntry {
  body: string;
  headers: [string, string][];
  status: number;
  statusText: string;
}

export type SerializedFetchCache = Record<string, SerializedFetchCacheEntry>;

interface SerializedDataCacheEntry {
  kind: "async" | "sync";
  value: unknown;
}

export interface SerializedPrerenderCache {
  data: Record<string, SerializedDataCacheEntry>;
  fetch: SerializedFetchCache;
}

export class CacheSignal {
  private pending = 0;
  private listeners: Array<() => void> = [];
  private scheduledCheck: (() => void) | undefined;

  track<T>(promise: Promise<T>): Promise<T> {
    this.pending++;
    this.cancelScheduledCheck();

    void promise.then(
      () => this.endRead(),
      () => this.endRead(),
    );

    return promise;
  }

  ready(): Promise<void> {
    return new Promise((resolve) => {
      this.listeners.push(resolve);
      if (this.pending === 0) {
        this.scheduleCheck();
      }
    });
  }

  private endRead() {
    if (this.pending === 0) {
      throw new Error("CacheSignal received more completions than pending reads");
    }

    this.pending--;
    if (this.pending === 0) {
      this.scheduleCheck();
    }
  }

  private scheduleCheck() {
    if (this.scheduledCheck) return;

    let cancelled = false;
    const cancelTask = scheduleAfterReactWork(() => {
      this.scheduledCheck = undefined;
      if (!cancelled && this.pending === 0) {
        const listeners = this.listeners;
        this.listeners = [];
        for (const listener of listeners) listener();
      }
    });

    this.scheduledCheck = () => {
      cancelled = true;
      cancelTask();
      this.scheduledCheck = undefined;
    };
  }

  private cancelScheduledCheck() {
    this.scheduledCheck?.();
  }
}

interface MemoryFetchCacheEntry {
  response: Response;
  serialized: SerializedFetchCacheEntry;
}

type MemoryDataCacheEntry =
  | { kind: "async"; value: Promise<unknown> }
  | { kind: "sync"; value: unknown };

export class PrerenderCache {
  private readonly fetchEntries = new Map<string, Promise<MemoryFetchCacheEntry>>();
  private readonly dataEntries = new Map<string, MemoryDataCacheEntry>();

  constructor(serialized?: SerializedPrerenderCache) {
    if (!serialized) return;

    for (const [key, entry] of Object.entries(serialized.fetch)) {
      this.fetchEntries.set(
        key,
        Promise.resolve({
          response: responseFromSerialized(entry),
          serialized: entry,
        }),
      );
    }

    for (const [key, entry] of Object.entries(serialized.data)) {
      this.dataEntries.set(
        key,
        entry.kind === "async"
          ? { kind: "async", value: Promise.resolve(entry.value) }
          : { kind: "sync", value: entry.value },
      );
    }
  }

  async fetch(
    input: RequestInfo | URL,
    init: RequestInit | undefined,
    originalFetch: typeof fetch,
    signal?: CacheSignal,
  ): Promise<Response> {
    const key = createFetchCacheKey(input, init);
    const existing = this.fetchEntries.get(key);
    if (existing) {
      return (await existing).response.clone();
    }

    const read = originalFetch(input, init).then(async (response) => ({
      response,
      serialized: await serializeResponse(response.clone()),
    }));
    const trackedRead = signal?.track(read) ?? read;
    this.fetchEntries.set(key, trackedRead);

    try {
      return (await trackedRead).response.clone();
    } catch (error) {
      this.fetchEntries.delete(key);
      throw error;
    }
  }

  data<T>(
    functionId: string,
    args: readonly unknown[],
    generate: () => T,
    signal?: CacheSignal,
  ): T {
    const key = functionId + ":" + stableStringify(args);
    const existing = this.dataEntries.get(key);
    if (existing) return existing.value as T;

    const generated = generate();
    if (!isPromiseLike(generated)) {
      this.dataEntries.set(key, { kind: "sync", value: generated });
      return generated;
    }

    const promise = Promise.resolve(generated);
    const tracked = signal?.track(promise) ?? promise;
    this.dataEntries.set(key, { kind: "async", value: tracked });

    void tracked.catch(() => {
      if (this.dataEntries.get(key)?.value === tracked) {
        this.dataEntries.delete(key);
      }
    });

    return tracked as T;
  }

  async serialize(): Promise<SerializedPrerenderCache> {
    const fetch: SerializedFetchCache = {};
    const data: Record<string, SerializedDataCacheEntry> = {};

    for (const [key, entry] of this.fetchEntries) {
      fetch[key] = (await entry).serialized;
    }

    for (const [key, entry] of this.dataEntries) {
      const value = await entry.value;
      assertSerializableData(value, key);
      data[key] = { kind: entry.kind, value };
    }

    return { data, fetch };
  }
}

function isPromiseLike<T>(value: T): value is T & PromiseLike<Awaited<T>> {
  return (
    (typeof value === "object" || typeof value === "function") &&
    value !== null &&
    "then" in value &&
    typeof value.then === "function"
  );
}

function stableStringify(value: unknown): string {
  const seen = new Set<object>();

  function normalize(input: unknown): unknown {
    if (
      input === null ||
      typeof input === "string" ||
      typeof input === "boolean" ||
      typeof input === "number"
    ) {
      return input;
    }

    if (typeof input === "undefined") return { $undefined: true };
    if (typeof input === "bigint") return { $bigint: input.toString() };

    if (typeof input !== "object") {
      throw new TypeError(`Unsupported cache argument type: ${typeof input}`);
    }

    if (seen.has(input)) {
      throw new TypeError("Cache arguments cannot contain circular references");
    }
    seen.add(input);

    try {
      if (Array.isArray(input)) return input.map(normalize);
      if (input instanceof Date) return { $date: input.toISOString() };
      if (input instanceof URL) return { $url: input.href };

      const prototype = Object.getPrototypeOf(input);
      if (prototype !== Object.prototype && prototype !== null) {
        throw new TypeError("Cache arguments must contain only plain objects and arrays");
      }

      return Object.fromEntries(
        Object.entries(input)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, entry]) => [key, normalize(entry)]),
      );
    } finally {
      seen.delete(input);
    }
  }

  return JSON.stringify(normalize(value));
}

function assertSerializableData(value: unknown, key: string) {
  if (value === undefined) {
    throw new TypeError(`Cached function ${key} returned undefined, which cannot be persisted`);
  }

  if (isReactElement(value)) {
    throw new TypeError(
      `Cached function ${key} returned a React element, which cannot be persisted as JSON`,
    );
  }

  try {
    JSON.stringify(value);
  } catch (error) {
    throw new TypeError(`Cached function ${key} returned a value that cannot be persisted`, {
      cause: error,
    });
  }
}

function isReactElement(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    "$$typeof" in value &&
    typeof (value as { $$typeof: unknown }).$$typeof === "symbol"
  );
}

function createFetchCacheKey(input: RequestInfo | URL, init?: RequestInit) {
  const request = new Request(input, init);
  return JSON.stringify({
    url: request.url,
    method: request.method,
    headers: [...request.headers.entries()],
    credentials: request.credentials,
    mode: request.mode,
    redirect: request.redirect,
    referrer: request.referrer,
    referrerPolicy: request.referrerPolicy,
    integrity: request.integrity,
  });
}

async function serializeResponse(response: Response): Promise<SerializedFetchCacheEntry> {
  return {
    body: bytesToBase64(new Uint8Array(await response.arrayBuffer())),
    headers: [...response.headers.entries()],
    status: response.status,
    statusText: response.statusText,
  };
}

function responseFromSerialized(entry: SerializedFetchCacheEntry) {
  return new Response(base64ToBytes(entry.body), {
    headers: entry.headers,
    status: entry.status,
    statusText: entry.statusText,
  });
}

export function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  const chunkSize = 32_768;

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }

  return btoa(binary);
}

export function base64ToBytes(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

function scheduleAfterReactWork(callback: () => void) {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const runtime = globalThis as typeof globalThis & {
    setImmediate?: (callback: () => void) => unknown;
    clearImmediate?: (handle: unknown) => void;
  };

  if (runtime.setImmediate) {
    const immediate = runtime.setImmediate(() => {
      timeout = setTimeout(callback, 0);
    });

    return () => {
      runtime.clearImmediate?.(immediate);
      if (timeout) clearTimeout(timeout);
    };
  }

  const firstTimeout = setTimeout(() => {
    timeout = setTimeout(callback, 0);
  }, 0);

  return () => {
    clearTimeout(firstTimeout);
    if (timeout) clearTimeout(timeout);
  };
}
