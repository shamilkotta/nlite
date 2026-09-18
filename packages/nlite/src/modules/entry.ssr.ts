import { createFromReadableStream } from "@vitejs/plugin-rsc/ssr";
import React, { createElement } from "react";
import { renderToReadableStream } from "react-dom/server.edge";
import { prerender } from "react-dom/static.edge";
import type { RscPayload } from "../types.js";
import { Document } from "../utils/elements/document.js";
import { suppressStreamClose, teeRscStream } from "../utils/stream.js";
import { runInSequentialTasks } from "../utils/scheduler.js";
import { runWithNavigationUrl } from "../internal/navigation-context.js";
import {
  getURLFromRedirectError,
  isNliteRouterError,
  isNotFoundError,
  isRedirectError,
} from "../lib/navigation/errors.js";
import { PostponedState } from "react-dom/static";
import { DynamicPrerenderUsageError } from "../internal/request-context.js";

export async function renderHtml(
  rscStream: ReadableStream,
  _options: { ssg: boolean; url: URL; abort?: boolean },
) {
  const [rscStream1, rscStream2] = await teeRscStream(rscStream);
  const held = _options.ssg && _options.abort ? suppressStreamClose(rscStream1) : undefined;
  const payload = createFromReadableStream<RscPayload>(held?.stream ?? rscStream1);
  function SsrRoot() {
    const { root, metadata } = React.use(payload);
    return createElement(Document, { metadata, children: root });
  }
  const bootstrapScriptContent = await import.meta.viteRsc.loadBootstrapScriptContent("index");

  let htmlStream: ReadableStream<Uint8Array>;
  let postponed: PostponedState | null = null;
  let status: number | undefined;
  if (_options?.ssg) {
    const controller = new AbortController();
    try {
      const prerenderResult = await runWithNavigationUrl(_options.url, () => {
        if (!_options.abort) {
          return prerender(createElement(SsrRoot), {
            bootstrapScriptContent,
            onError: reportRenderError,
            signal: controller.signal,
          });
        }

        return runInSequentialTasks(
          () =>
            prerender(createElement(SsrRoot), {
              bootstrapScriptContent,
              onError: reportRenderError,
              signal: controller.signal,
            }),
          () => {
            if (!controller.signal.aborted) {
              controller.abort(new DynamicPrerenderUsageError());
            }
          },
        );
      });
      postponed = prerenderResult.postponed;
      htmlStream = prerenderResult.prelude;
    } catch (error) {
      if (isRedirectError(error)) {
        htmlStream = await prerenderNavigationShell(bootstrapScriptContent, [
          createElement("title", null, "Redirecting..."),
          createElement("meta", {
            key: "redirect",
            httpEquiv: "refresh",
            content: `0;url=${getURLFromRedirectError(error)}`,
          }),
        ]);
      } else if (isNotFoundError(error)) {
        htmlStream = await prerenderNavigationShell(bootstrapScriptContent, [
          createElement("title", null, "404: This page could not be found"),
          createElement("meta", { key: "robots", name: "robots", content: "noindex" }),
        ]);
      } else {
        throw error;
      }
    } finally {
      held?.release();
    }
  } else {
    try {
      htmlStream = await runWithNavigationUrl(_options.url, () =>
        renderToReadableStream(createElement(SsrRoot), {
          onError: reportRenderError,
          bootstrapScriptContent,
        }),
      );
    } catch (error) {
      if (isRedirectError(error)) {
        htmlStream = await renderNavigationShell(bootstrapScriptContent, [
          createElement("title", null, "Redirecting..."),
          createElement("meta", {
            key: "redirect",
            httpEquiv: "refresh",
            content: `0;url=${getURLFromRedirectError(error)}`,
          }),
        ]);
      } else if (isNotFoundError(error)) {
        status = 404;
        htmlStream = await renderNavigationShell(bootstrapScriptContent, [
          createElement("title", null, "404: This page could not be found"),
          createElement("meta", { key: "robots", name: "robots", content: "noindex" }),
        ]);
      } else {
        console.error("[nlite] SSR render failed", error);
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
    }
  }

  let responseStream: ReadableStream<Uint8Array> = htmlStream;
  responseStream = responseStream.pipeThrough(injectRSCPayload(rscStream2));
  return { stream: responseStream, status, postponed };
}

function reportRenderError(error: unknown) {
  if (!isNliteRouterError(error) && !DynamicPrerenderUsageError.isInstance(error)) {
    console.error(error);
  }
}

function renderNavigationShell(bootstrapScriptContent: string, metadata: React.ReactNode) {
  return renderToReadableStream(createNavigationShell(metadata), { bootstrapScriptContent });
}

async function prerenderNavigationShell(bootstrapScriptContent: string, metadata: React.ReactNode) {
  const result = await prerender(createNavigationShell(metadata), { bootstrapScriptContent });
  return result.prelude;
}

function createNavigationShell(headExtras: React.ReactNode) {
  return createElement(Document, {
    metadata: {},
    headExtras,
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

  async function startRSC(controller: TransformStreamDefaultController<Uint8Array>) {
    if (startedRSC) {
      await flightDataPromise;
      return;
    }

    startedRSC = true;
    try {
      await writeRSCStream(rscStream, controller);
    } catch (error) {
      controller.error(error);
    } finally {
      resolveFlightDataPromise();
    }
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

        void startRSC(controller);
      }, 0);
    },
    async flush(controller) {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
        flushBufferedChunks(controller);
      }
      await startRSC(controller);
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
