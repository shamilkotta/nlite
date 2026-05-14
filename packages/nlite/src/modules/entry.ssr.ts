import { createFromReadableStream } from "@vitejs/plugin-rsc/ssr";
import React, { createElement } from "react";
import { renderToReadableStream, resume } from "react-dom/server.edge";
import { prerender } from "react-dom/static.edge";
import type { RscPayload } from "../types.js";

export async function renderHtml(rscStream: ReadableStream) {
  const bootstrapScriptContent = await import.meta.viteRsc.loadBootstrapScriptContent("index");
  const { SsrRoot, rscStream: injectableRscStream } = createSsrRoot(rscStream);

  let htmlStream: ReadableStream<Uint8Array>;
  let status: number | undefined;
  try {
    htmlStream = await renderToReadableStream(createElement(SsrRoot), {
      bootstrapScriptContent,
    });
  } catch (error) {
    console.error("[nlite] SSR render failed", error);
    // fallback to render an empty shell and run pure CSR on browser,
    // which can replay server component error and trigger error boundary.
    status = 500;
    htmlStream = await renderToReadableStream(
      createElement(
        "html",
        null,
        createElement(
          "body",
          null,
          createElement("noscript", null, "Internal Server Error: SSR failed"),
        ),
      ),
      {
        bootstrapScriptContent: `self.__NO_HYDRATE=1;` + bootstrapScriptContent,
      },
    );
  }

  return {
    stream: htmlStream.pipeThrough(injectRSCPayload(injectableRscStream!)),
    status,
  };
}

export async function prerenderHtml(rscStream: ReadableStream) {
  const bootstrapScriptContent = await import.meta.viteRsc.loadBootstrapScriptContent("index");
  const { SsrRoot } = createSsrRoot(rscStream, { tee: false });
  const controller = new AbortController();
  const reason = new PrerenderPostponed();
  let isPending = true;

  const prerenderResult = await runInSequentialTasks(
    async () => {
      const pendingResult = prerender(createElement(SsrRoot), {
        bootstrapScriptContent,
        signal: controller.signal,
        onError(error) {
          if (error !== reason) {
            console.error(error);
          }
        },
      });
      const result = await pendingResult;
      isPending = false;
      return result;
    },
    () => {
      if (isPending) {
        controller.abort(reason);
      }
    },
  );

  return {
    prelude: prerenderResult.prelude,
    postponed: prerenderResult.postponed,
  };
}

class PrerenderPostponed extends Error {
  constructor() {
    super("[nlite] HTML prerender postponed");
  }
}

export async function resumeHtml(rscStream: ReadableStream, postponed: unknown) {
  const { SsrRoot, rscStream: injectableRscStream } = createSsrRoot(rscStream);
  const htmlStream = await resume(createElement(SsrRoot), postponed as never);

  return {
    stream: htmlStream.pipeThrough(injectRSCPayload(injectableRscStream!)),
  };
}

function createSsrRoot(
  rscStream: ReadableStream,
  options: { signal?: AbortSignal; tee?: boolean } = {},
) {
  const cancellableRscStream = options.signal
    ? cancelReadableStreamOnAbort(rscStream, options.signal)
    : rscStream;
  const [rscStream1, rscStream2] =
    options.tee === false ? [cancellableRscStream, undefined] : cancellableRscStream.tee();
  let payload: Promise<RscPayload>;
  function SsrRoot() {
    payload ??= createFromReadableStream<RscPayload>(rscStream1);
    return React.use(payload).root;
  }

  return { SsrRoot, rscStream: rscStream2 };
}

function runInSequentialTasks<R>(first: () => R, ...rest: Array<() => void>) {
  return new Promise<Awaited<R>>((resolve, reject) => {
    let result: R;
    const ids: ReturnType<typeof setTimeout>[] = [];

    ids.push(
      setTimeout(() => {
        try {
          result = first();
          if (isThenable(result)) {
            result.then(
              () => {},
              () => {},
            );
          }
        } catch (error) {
          for (const id of ids.slice(1)) {
            clearTimeout(id);
          }
          reject(error);
        }
      }, 0),
    );

    for (const fn of rest) {
      ids.push(
        setTimeout(() => {
          try {
            fn();
          } catch (error) {
            reject(error);
          }
        }, 0),
      );
    }

    ids.push(
      setTimeout(async () => {
        try {
          resolve(await result!);
        } catch (error) {
          reject(error);
        }
      }, 0),
    );
  });
}

function isThenable<T>(value: T): value is T & PromiseLike<Awaited<T>> {
  return typeof value === "object" && value !== null && "then" in value;
}

function cancelReadableStreamOnAbort<T>(stream: ReadableStream<T>, signal: AbortSignal) {
  if (signal.aborted) {
    return new ReadableStream<T>({
      start(controller) {
        controller.error(signal.reason);
      },
    });
  }

  const reader = stream.getReader();
  let abortHandler: (() => void) | undefined;
  const cleanup = () => {
    if (abortHandler) {
      signal.removeEventListener("abort", abortHandler);
      abortHandler = undefined;
    }
  };

  return new ReadableStream<T>({
    start(controller) {
      abortHandler = () => {
        reader.cancel(signal.reason).catch(() => {});
        controller.error(signal.reason);
      };
      signal.addEventListener("abort", abortHandler, { once: true });
    },
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          cleanup();
          controller.close();
          return;
        }
        controller.enqueue(value);
      } catch (error) {
        cleanup();
        controller.error(error);
      }
    },
    cancel(reason) {
      cleanup();
      return reader.cancel(reason);
    },
  });
}

if (import.meta.hot) {
  import.meta.hot.accept();
}

// https://github.com/devongovett/rsc-html-stream/blob/main/server.js
const encoder = new TextEncoder();
const trailer = "</body></html>";

function injectRSCPayload(rscStream: ReadableStream<Uint8Array>) {
  const decoder = new TextDecoder();
  let resolveFlightDataPromise!: () => void;
  const flightDataPromise = new Promise<void>((resolve) => {
    resolveFlightDataPromise = resolve;
  });
  let startedRSC = false;

  let buffered: Uint8Array[] = [];
  let timeout: ReturnType<typeof setTimeout> | null = null;

  function flushBufferedChunks(controller: TransformStreamDefaultController<Uint8Array>) {
    for (const chunk of buffered) {
      let text = decoder.decode(chunk, { stream: true });
      if (text.endsWith(trailer)) {
        text = text.slice(0, -trailer.length);
      }
      controller.enqueue(encoder.encode(text));
    }

    let remaining = decoder.decode();
    if (remaining.length) {
      if (remaining.endsWith(trailer)) {
        remaining = remaining.slice(0, -trailer.length);
      }
      controller.enqueue(encoder.encode(remaining));
    }

    buffered = [];
    timeout = null;
  }

  return new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      buffered.push(chunk);
      if (timeout) {
        return;
      }

      timeout = setTimeout(() => {
        try {
          flushBufferedChunks(controller);
        } catch (error) {
          controller.error(error);
          resolveFlightDataPromise();
          return;
        }

        if (!startedRSC) {
          startedRSC = true;
          writeRSCStream(rscStream, controller)
            .catch((error) => controller.error(error))
            .then(resolveFlightDataPromise);
        }
      }, 0);
    },
    async flush(controller) {
      await flightDataPromise;
      if (timeout) {
        clearTimeout(timeout);
        flushBufferedChunks(controller);
      }
      controller.enqueue(encoder.encode(trailer));
    },
  });
}

async function writeRSCStream(
  rscStream: ReadableStream<Uint8Array>,
  controller: TransformStreamDefaultController<Uint8Array>,
) {
  const decoder = new TextDecoder();
  const reader = rscStream.getReader();

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      const remaining = decoder.decode();
      if (remaining.length) {
        controller.enqueue(
          encoder.encode(
            "<script>window.__NLITE_PUSH_RSC__&&window.__NLITE_PUSH_RSC__(" +
              serializeInlineScriptValue(remaining) +
              ")</script>",
          ),
        );
      }
      controller.enqueue(
        encoder.encode("<script>window.__NLITE_CLOSE_RSC__&&window.__NLITE_CLOSE_RSC__()</script>"),
      );
      break;
    }

    const chunk = decoder.decode(value, { stream: true });
    controller.enqueue(
      encoder.encode(
        "<script>window.__NLITE_PUSH_RSC__&&window.__NLITE_PUSH_RSC__(" +
          serializeInlineScriptValue(chunk) +
          ")</script>",
      ),
    );
  }
}

function serializeInlineScriptValue(value: unknown) {
  return JSON.stringify(value)
    .replace(/</g, "\\u003C")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
