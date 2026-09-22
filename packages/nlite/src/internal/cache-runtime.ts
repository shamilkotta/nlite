import { createFromReadableStream } from "@vitejs/plugin-rsc/rsc/client";
import { renderToReadableStream } from "@vitejs/plugin-rsc/rsc/server";

import { getRequestCache } from "./request-context.js";
import { base64ToBytes, bytesToBase64 } from "./prerender-cache.js";

const CACHE_STREAM_OPTIONS = {
  environmentName: "Cache",
  replayConsoleLogs: true,
} as const;

export function createCachedFunction<Args extends readonly unknown[], Result>(
  functionId: string,
  fn: (...args: Args) => Result,
) {
  return (...args: Args): Promise<Awaited<Result>> => {
    const { cache, cacheSignal } = getRequestCache();
    return decodeCachedResult(
      cache.data(functionId, args, () => encodeCachedResult(fn(...args)), cacheSignal),
    );
  };
}

async function encodeCachedResult(result: unknown): Promise<string> {
  const value = await result;
  if (value === undefined) {
    throw new TypeError("Cached function returned undefined, which cannot be persisted");
  }

  const stream = renderToReadableStream(value, { environmentName: "Cache" });
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  return bytesToBase64(bytes);
}

function decodeCachedResult<T>(encoded: string | Promise<string>): Promise<T> {
  return Promise.resolve(encoded).then((payload) =>
    createFromReadableStream<T>(arrayToStream(base64ToBytes(payload)), CACHE_STREAM_OPTIONS),
  );
}

function arrayToStream(data: Uint8Array): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(data);
      controller.close();
    },
  });
}
