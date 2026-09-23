import { pathToFileURL } from "node:url";

import { NOT_FOUND_ROUTE_PATH, PRERENDER_ORIGIN } from "../utils/constants.js";
import type { SerializedPrerenderCache } from "./prerender-cache.js";
import { PostponedState } from "react-dom/static";

type PrerenderWorkerInput = {
  ppr?: boolean;
  entryPath: string;
  routePath: string;
  forcePrerender: boolean;
};

export type PrerenderWorkerResult =
  | {
      skip: true;
    }
  | {
      skip: false;
      stream: number[];
      rsc: number[];
      postponed: PostponedState | null;
      cache?: SerializedPrerenderCache;
    };

export type PrerenderWorker = {
  renderRoute(input: PrerenderWorkerInput): Promise<PrerenderWorkerResult>;
  renderNotFound(input: { entryPath: string }): Promise<PrerenderWorkerResult>;
};

export async function renderRoute({
  ppr,
  entryPath,
  routePath,
  forcePrerender,
}: PrerenderWorkerInput): Promise<PrerenderWorkerResult> {
  const entry: typeof import("../modules/entry.rsc.js") = await import(
    /* @vite-ignore */ pathToFileURL(entryPath).href
  );

  if (!entry.handlePrerender) {
    throw new Error("RSC entry does not export handlePrerender()");
  }

  const request = new Request(new URL(routePath, PRERENDER_ORIGIN));
  const result = await entry.handlePrerender(request, {
    ppr,
    forcePrerender,
  });

  if (result.skip) {
    return { skip: true };
  }

  const [streamBytes, rscBytes] = await Promise.all([
    readStream(result.stream),
    readStream(result.rsc),
  ]);
  return {
    skip: false,
    stream: [...streamBytes],
    rsc: [...rscBytes],
    postponed: result.postponed,
    cache: result.cache,
  };
}

export async function renderNotFound({
  entryPath,
}: {
  entryPath: string;
}): Promise<PrerenderWorkerResult> {
  const entry: typeof import("../modules/entry.rsc.js") = await import(
    /* @vite-ignore */ pathToFileURL(entryPath).href
  );

  if (!entry.handleGlobalNotFoundPrerender) {
    return { skip: true };
  }

  const request = new Request(new URL(NOT_FOUND_ROUTE_PATH, PRERENDER_ORIGIN));
  const result = await entry.handleGlobalNotFoundPrerender(request, {});

  if (result.skip) {
    return { skip: true };
  }

  const [streamBytes, rscBytes] = await Promise.all([
    readStream(result.stream),
    readStream(result.rsc),
  ]);
  return {
    skip: false,
    stream: [...streamBytes],
    rsc: [...rscBytes],
    postponed: result.postponed,
    cache: result.cache,
  };
}

async function readStream(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;

    chunks.push(value);
    byteLength += value.byteLength;
  }

  const bytes = new Uint8Array(byteLength);
  let offset = 0;

  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return bytes;
}
