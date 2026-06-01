import { pathToFileURL } from "node:url";

import { PRERENDER_ORIGIN } from "../utils/constants.js";

type PrerenderWorkerInput = {
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
    };

export type PrerenderWorker = {
  renderRoute(input: PrerenderWorkerInput): Promise<PrerenderWorkerResult>;
};

declare const process: NodeJS.Process & {
  send?(message: { type: "dynamicUsage" }): boolean;
};

export async function renderRoute({
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
  const { rsc, stream, skip } = await entry.handlePrerender(request, {
    forcePrerender,
    onDynamicUsage() {
      process.send?.({ type: "dynamicUsage" });
    },
  });

  if (skip || !stream || !rsc) {
    return { skip: true };
  }

  const [streamBytes, rscBytes] = await Promise.all([readStream(stream), readStream(rsc)]);
  return {
    skip: false,
    stream: [...streamBytes],
    rsc: [...rscBytes],
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
