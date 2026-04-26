import { createFromReadableStream } from "@vitejs/plugin-rsc/ssr";
import React, { createElement } from "react";
import { renderToReadableStream } from "react-dom/server.edge";
import { prerender } from "react-dom/static.edge";
import type { RscPayload } from "../types.js";

export async function renderHtml(rscStream: ReadableStream, _options: { ssg: boolean }) {
  const [rscStream1, rscStream2] = rscStream.tee();
  let payload: Promise<RscPayload>;
  function SsrRoot() {
    payload ??= createFromReadableStream<RscPayload>(rscStream1);
    return React.use(payload).root;
  }
  const bootstrapScriptContent = await import.meta.viteRsc.loadBootstrapScriptContent("index");

  let htmlStream: ReadableStream<Uint8Array>;
  let status: number | undefined;
  if (_options?.ssg) {
    // for static site generation, let errors throw to fail the build
    const prerenderResult = await prerender(createElement(SsrRoot), {
      bootstrapScriptContent,
    });
    htmlStream = prerenderResult.prelude;
  } else {
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
  }

  let responseStream: ReadableStream<Uint8Array> = htmlStream;
  responseStream = responseStream.pipeThrough(injectRSCPayload(rscStream2));
  return { stream: responseStream, status };
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
