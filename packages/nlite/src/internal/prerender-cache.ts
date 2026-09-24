import { createHash } from "node:crypto";

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
    if (!fetchBodyNeedsAsyncRead(input, init)) {
      const prepared = prepareFetchCacheRequest(input, init);
      const existing = this.fetchEntries.get(prepared.key);
      if (existing) {
        const hit = existing.then((entry) => entry.response.clone());
        return signal ? signal.track(hit) : hit;
      }

      const read = originalFetch(prepared.input, prepared.init).then(async (response) => ({
        response,
        serialized: await serializeResponse(response.clone()),
      }));
      this.fetchEntries.set(prepared.key, read);
      const tracked = signal?.track(read) ?? read;

      try {
        return (await tracked).response.clone();
      } catch (error) {
        this.fetchEntries.delete(prepared.key);
        throw error;
      }
    }

    const run = async () => {
      const prepared = await prepareFetchCacheRequestAsync(input, init);
      const existing = this.fetchEntries.get(prepared.key);
      if (existing) {
        return (await existing).response.clone();
      }

      const read = originalFetch(prepared.input, prepared.init).then(async (response) => ({
        response,
        serialized: await serializeResponse(response.clone()),
      }));
      this.fetchEntries.set(prepared.key, read);

      try {
        return (await read).response.clone();
      } catch (error) {
        this.fetchEntries.delete(prepared.key);
        throw error;
      }
    };

    return signal ? signal.track(run()) : run();
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

const FETCH_CACHE_KEY_PREFIX = "v4";
type FetchBody = NonNullable<RequestInit["body"] | Request["body"]>;
type CacheKeyInit = RequestInit & { _ogBody?: FetchBody };
type PreparedFetch = {
  key: string;
  input: RequestInfo | URL;
  init: RequestInit | undefined;
};

function fetchBodyNeedsAsyncRead(input: RequestInfo | URL, init?: RequestInit) {
  const body =
    init?.body ??
    (input && typeof input === "object" && "body" in input ? (input as Request).body : null);
  if (!body || typeof body === "string" || isBodyByteSequence(body)) return false;
  if (isBodyFormDataOrURLSearchParams(body)) {
    for (const [, val] of body.entries()) {
      if (typeof val !== "string") return true;
    }
    return false;
  }
  return isBodyReadableStream(body) || isBodyBlob(body);
}

function prepareFetchCacheRequest(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
): PreparedFetch {
  const { resolvedInput, resolvedInit, isRequestInput, url, keyInit } = resolveFetchCacheInputs(
    input,
    init,
  );
  const key = generateFetchCacheKeySync(url, keyInit);
  return finishPreparedFetch(key, resolvedInput, resolvedInit, isRequestInput);
}

async function prepareFetchCacheRequestAsync(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
): Promise<PreparedFetch> {
  const { resolvedInput, resolvedInit, isRequestInput, url, keyInit } = resolveFetchCacheInputs(
    input,
    init,
  );
  const key = await generateFetchCacheKeyAsync(url, keyInit);
  return finishPreparedFetch(key, resolvedInput, resolvedInit, isRequestInput);
}

function resolveFetchCacheInputs(input: RequestInfo | URL, init: RequestInit | undefined) {
  let resolvedInput = input;
  let resolvedInit = init;

  const isRequestInput =
    !!resolvedInput &&
    typeof resolvedInput === "object" &&
    typeof (resolvedInput as Request).method === "string";

  if (isRequestInput && resolvedInit) {
    const { next: _next, ...overrides } = resolvedInit as RequestInit & {
      next?: unknown;
    };
    resolvedInput = new Request(resolvedInput as Request, overrides);
    resolvedInit = undefined;
  }

  const url = normalizeFetchCacheUrl(
    isRequestInput ? (resolvedInput as Request).url : resolvedInput,
  );

  const keyInit: CacheKeyInit = isRequestInput
    ? (resolvedInput as CacheKeyInit)
    : ((resolvedInit ?? {}) as CacheKeyInit);

  return { resolvedInput, resolvedInit, isRequestInput, url, keyInit };
}

function finishPreparedFetch(
  key: string,
  resolvedInput: RequestInfo | URL,
  resolvedInit: RequestInit | undefined,
  isRequestInput: boolean,
): PreparedFetch {
  if (isRequestInput) {
    const reqInput = resolvedInput as Request & { _ogBody?: FetchBody };
    if (reqInput._ogBody !== undefined) {
      return {
        key,
        input: new Request(reqInput.url, {
          body: reqInput._ogBody,
          cache: reqInput.cache,
          credentials: reqInput.credentials,
          headers: reqInput.headers,
          integrity: reqInput.integrity,
          keepalive: reqInput.keepalive,
          method: reqInput.method,
          mode: reqInput.mode,
          redirect: reqInput.redirect,
          referrer: reqInput.referrer,
          referrerPolicy: reqInput.referrerPolicy,
          duplex: "half",
        } as RequestInit),
        init: resolvedInit,
      };
    }
    return { key, input: resolvedInput, init: resolvedInit };
  }

  if (resolvedInit && (resolvedInit as CacheKeyInit)._ogBody !== undefined) {
    const { _ogBody, body, ...otherInit } = resolvedInit as CacheKeyInit;
    return {
      key,
      input: resolvedInput,
      init: { ...otherInit, body: _ogBody ?? body },
    };
  }

  return { key, input: resolvedInput, init: resolvedInit };
}

function normalizeFetchCacheUrl(input: RequestInfo | URL) {
  try {
    const url = new URL(input instanceof Request ? input.url : input);
    url.username = "";
    url.password = "";
    return url.href;
  } catch {
    return "";
  }
}

function generateFetchCacheKeySync(url: string, init: CacheKeyInit): string {
  const { bodyChunks, bodyType } = collectSyncBodyChunks(init);
  return hashFetchCacheKey(url, init, bodyType, bodyChunks);
}

async function generateFetchCacheKeyAsync(url: string, init: CacheKeyInit): Promise<string> {
  const { bodyChunks, bodyType } = await collectAsyncBodyChunks(init);
  return hashFetchCacheKey(url, init, bodyType, bodyChunks);
}

function collectSyncBodyChunks(init: CacheKeyInit) {
  const bodyChunks: string[] = [];
  let bodyType: string | null = null;
  const body = init.body;

  if (!body) return { bodyChunks, bodyType };

  if (isBodyByteSequence(body)) {
    bodyChunks.push(`bytes:${toHex(body)}`);
    init._ogBody = body;
  } else if (isBodyFormDataOrURLSearchParams(body)) {
    bodyType =
      String(body) === "[object FormData]"
        ? "multipart/form-data; boundary="
        : "application/x-www-form-urlencoded;charset=UTF-8";
    init._ogBody = body;
    for (const [key, val] of body.entries()) {
      bodyChunks.push(`key:${key}`);
      if (typeof val !== "string") {
        throw new Error("FormData file bodies require async cache key generation");
      }
      bodyChunks.push(`str:${val}`);
    }
  } else if (typeof body === "string") {
    bodyChunks.push(`str:${body}`);
    init._ogBody = body;
    bodyType = "text/plain;charset=UTF-8";
  } else {
    throw new Error(`Unsupported sync body type: ${typeof body}`);
  }

  return { bodyChunks, bodyType };
}

async function collectAsyncBodyChunks(init: CacheKeyInit) {
  const bodyChunks: string[] = [];
  let bodyType: string | null = null;
  const body = init.body;

  if (!body) return { bodyChunks, bodyType };

  if (isBodyByteSequence(body)) {
    bodyChunks.push(`bytes:${toHex(body)}`);
    init._ogBody = body;
  } else if (isBodyReadableStream(body)) {
    const chunks: Uint8Array[] = [];
    const encoder = new TextEncoder();
    try {
      await body.pipeTo(
        new WritableStream({
          write(chunk) {
            chunks.push(typeof chunk === "string" ? encoder.encode(chunk) : chunk);
          },
        }),
      );
      const length = chunks.reduce((total, arr) => total + arr.length, 0);
      const arrayBuffer = new Uint8Array(length);
      let offset = 0;
      for (const chunk of chunks) {
        arrayBuffer.set(chunk, offset);
        offset += chunk.length;
      }
      bodyChunks.push(`bytes:${toHex(arrayBuffer)}`);
      init._ogBody = arrayBuffer;
    } catch (error) {
      console.error("Problem reading body", error);
    }
  } else if (isBodyFormDataOrURLSearchParams(body)) {
    bodyType =
      String(body) === "[object FormData]"
        ? "multipart/form-data; boundary="
        : "application/x-www-form-urlencoded;charset=UTF-8";
    init._ogBody = body;
    for (const [key, val] of body.entries()) {
      bodyChunks.push(`key:${key}`);
      if (typeof val === "string") {
        bodyChunks.push(`str:${val}`);
      } else {
        bodyChunks.push("file", val.name, val.type, `bytes:${toHex(await val.arrayBuffer())}`);
      }
    }
  } else if (isBodyBlob(body)) {
    const arrayBuffer = await body.arrayBuffer();
    bodyChunks.push("blob", body.type, `bytes:${toHex(arrayBuffer)}`);
    init._ogBody = new Blob([arrayBuffer], { type: body.type });
    bodyType = body.type;
  } else if (typeof body === "string") {
    bodyChunks.push(`str:${body}`);
    init._ogBody = body;
    bodyType = "text/plain;charset=UTF-8";
  } else {
    throw new Error(`Unsupported body type: ${typeof body}`);
  }

  return { bodyChunks, bodyType };
}

function hashFetchCacheKey(
  url: string,
  init: CacheKeyInit,
  bodyType: string | null,
  bodyChunks: string[],
) {
  const headers =
    typeof (init.headers ?? {}).keys === "function"
      ? Object.fromEntries(init.headers as Headers)
      : Object.assign({} as Record<string, string>, init.headers);

  if ("traceparent" in headers) delete headers.traceparent;
  if ("tracestate" in headers) delete headers.tracestate;

  const cacheString = JSON.stringify([
    FETCH_CACHE_KEY_PREFIX,
    "",
    url,
    init.method,
    bodyType,
    headers,
    init.mode,
    init.redirect,
    init.credentials,
    init.referrer,
    init.referrerPolicy,
    init.integrity,
    init.cache,
    bodyChunks,
  ]);

  return hashString(cacheString);
}

function toHex(buffer: ArrayBufferView | ArrayBuffer) {
  const bytes = isArrayBuffer(buffer)
    ? new Uint8Array(buffer)
    : new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  let hex = "";
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, "0");
  }
  return hex;
}

function isArrayBuffer(buffer: ArrayBuffer | ArrayBufferView): buffer is ArrayBuffer {
  return !("buffer" in buffer);
}

function isBodyByteSequence(body: FetchBody): body is ArrayBufferView<ArrayBuffer> | ArrayBuffer {
  return typeof body === "object" && body !== null && "byteLength" in body;
}

function isBodyReadableStream(body: FetchBody): body is ReadableStream {
  return typeof (body as ReadableStream).getReader === "function";
}

function isBodyFormDataOrURLSearchParams(body: FetchBody): body is FormData | URLSearchParams {
  return typeof (body as FormData).keys === "function";
}

function isBodyBlob(body: FetchBody): body is Blob {
  return (
    typeof body === "object" &&
    body !== null &&
    typeof (body as Blob).arrayBuffer === "function" &&
    !("byteLength" in body)
  );
}

function hashString(cacheString: string) {
  return createHash("sha256").update(cacheString).digest("hex");
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
