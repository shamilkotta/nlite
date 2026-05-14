import React from "react";
import { renderToReadableStream } from "@vitejs/plugin-rsc/rsc";
import { prerender } from "@vitejs/plugin-rsc/vendor/react-server-dom/static.edge";
import { createClientManifest } from "@vitejs/plugin-rsc/core/rsc";
import routes from "virtual:nlite/routes";
import { createRouteElement, matchRoute } from "../runtime.js";
import type { RscPayload } from "../types.js";
import {
  normalizeHtmlFilePath,
  normalizePostponedFilePath,
  normalizeRscFilePath,
} from "../utils/path.js";

function toRscPathname(pathname: string) {
  return pathname.endsWith(".rsc") ? pathname.slice(0, -4) || "/" : pathname;
}

function Document({ children, pathname }: { children: React.ReactNode; pathname: string }) {
  return React.createElement(
    "html",
    { lang: "en" },
    React.createElement(
      "head",
      null,
      React.createElement("meta", { charSet: "utf-8" }),
      React.createElement("meta", {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      }),
      import.meta.viteRsc.loadCss(),
    ),
    React.createElement(
      "body",
      null,
      React.createElement("script", {
        dangerouslySetInnerHTML: {
          __html: getInlineRscBootstrapScript(),
        },
      }),
      React.createElement("script", {
        dangerouslySetInnerHTML: {
          __html: "window.__NLITE_DATA__=" + JSON.stringify({ pathname }),
        },
      }),
      children,
    ),
  );
}

export default async function handler(request: Request) {
  const renderRequest = parseRenderRequest(request);
  const pathname = renderRequest.pathname;
  const match = matchRoute(routes, pathname);

  if (!match) {
    return new Response("Not Found", {
      status: 404,
      headers: { "content-type": "text/plain;charset=utf-8" },
    });
  }

  if (import.meta.env.PROD) {
    // TODO:
    const prerenderedResponse = await loadPrerenderedRoute(renderRequest, () =>
      renderRuntimeRoute(match, renderRequest),
    );
    if (prerenderedResponse) {
      return prerenderedResponse;
    }
  }

  return renderRuntimeRoute(match, renderRequest);
}

async function renderRuntimeRoute(
  match: NonNullable<ReturnType<typeof matchRoute>>,
  renderRequest: ReturnType<typeof parseRenderRequest>,
) {
  const app = createRouteElement(match.route, match.params, renderRequest.url.searchParams);
  const documentNode = React.createElement(Document, {
    children: app,
    pathname: renderRequest.pathname,
  });
  const rscPayload = { root: documentNode };
  const rscStream = renderToReadableStream<RscPayload>(rscPayload);

  if (renderRequest.isRsc) {
    return new Response(rscStream, {
      headers: { "content-type": "text/x-component;charset=utf-8" },
    });
  }

  const ssrEntry = await import.meta.viteRsc.loadModule<typeof import("./entry.ssr.ts")>(
    "ssr",
    "index",
  );
  const { stream: htmlStream, status } = await ssrEntry.renderHtml(rscStream);

  return new Response(htmlStream, {
    status,
    headers: {
      "content-type": "text/html;charset=utf-8",
    },
  });
}

function getInlineRscBootstrapScript() {
  return [
    "(() => {",
    "  const encoder = new TextEncoder();",
    "  let controller = null;",
    "  let closed = false;",
    "  const pending = [];",
    "  const stream = new ReadableStream({",
    "    start(nextController) {",
    "      controller = nextController;",
    "      for (const chunk of pending) controller.enqueue(encoder.encode(chunk));",
    "      if (closed) controller.close();",
    "    }",
    "  });",
    "  window.__NLITE_READ_RSC__ = () => stream;",
    "  window.__NLITE_PUSH_RSC__ = (chunk) => {",
    "    if (controller) {",
    "      controller.enqueue(encoder.encode(chunk));",
    "      return;",
    "    }",
    "    pending.push(chunk);",
    "  };",
    "  window.__NLITE_CLOSE_RSC__ = () => {",
    "    closed = true;",
    "    if (controller) controller.close();",
    "  };",
    "})();",
  ].join("");
}

if (import.meta.hot) {
  import.meta.hot.accept();
}

export async function collectPaths() {
  return routes.map((route) => route.routePath);
}

export async function handlePrerender(request: Request) {
  const renderRequest = parseRenderRequest(request);
  const match = matchRoute(routes, renderRequest.pathname);

  if (!match) {
    throw new Error('Cannot prerender unknown route "' + renderRequest.pathname + '"');
  }

  const app = createRouteElement(match.route, match.params, renderRequest.url.searchParams);
  const documentNode = React.createElement(Document, {
    children: app,
    pathname: renderRequest.pathname,
  });
  const rscPayload = { root: documentNode };
  const ssrEntry = await import.meta.viteRsc.loadModule<typeof import("./entry.ssr.ts")>(
    "ssr",
    "index",
  );

  const rscResult = await prerenderRscShell(rscPayload);
  const rscStream = createUnclosingStream(rscResult.chunks);

  const { prelude: htmlStream, postponed } = await ssrEntry.prerenderHtml(rscStream);
  return { stream: htmlStream, rsc: createClosingStream(rscResult.chunks), postponed };
}

async function prerenderRscShell(rscPayload: RscPayload) {
  const controller = new AbortController();
  const reason = new PrerenderPostponed();
  let isPending = true;

  const result = await runInSequentialTasks(
    async () => {
      const pendingResult = prerender(rscPayload, createClientManifest(), {
        signal: controller.signal,
        onError(error) {
          if (error !== reason) {
            console.error(error);
          }
        },
      });
      const prerenderResult = await pendingResult;
      isPending = false;
      return prerenderResult;
    },
    () => {
      if (isPending) {
        controller.abort(reason);
      }
    },
  );

  return { chunks: await streamToChunks(result.prelude) };
}

class PrerenderPostponed extends Error {
  constructor() {
    super("[nlite] RSC prerender postponed");
  }
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

function parseRenderRequest(request: Request) {
  const url = new URL(request.url);
  const pathname = toRscPathname(url.pathname);

  return {
    isRsc: url.pathname.endsWith(".rsc"),
    pathname,
    url,
  };
}

async function loadPrerenderedRoute(
  renderRequest: ReturnType<typeof parseRenderRequest>,
  createRuntimeResponse: () => Promise<Response>,
) {
  if (renderRequest.isRsc) {
    return loadPrerenderedRscRoute(renderRequest);
  }

  const staticUrl = new URL(`/${normalizeHtmlFilePath(renderRequest.pathname)}`, renderRequest.url);

  const staticResponse = await fetch(staticUrl);
  if (!staticResponse.ok) {
    return undefined;
  }

  const postponedResponse = await fetch(
    new URL(`/${normalizePostponedFilePath(renderRequest.pathname)}`, renderRequest.url),
  );

  if (postponedResponse.status === 404) {
    return staticResponse;
  }

  if (!postponedResponse.ok) {
    return undefined;
  }

  try {
    const postponed = await postponedResponse.json();
    const match = matchRoute(routes, renderRequest.pathname);
    if (!match) {
      return undefined;
    }

    const resumeRscStream = createRscStream(match, renderRequest);
    const ssrEntry = await import.meta.viteRsc.loadModule<typeof import("./entry.ssr.ts")>(
      "ssr",
      "index",
    );
    const { stream: resumeStream } = await ssrEntry.resumeHtml(resumeRscStream, postponed);

    return new Response(concatHtmlStreams(staticResponse.body, resumeStream), {
      headers: {
        "content-type": "text/html;charset=utf-8",
      },
    });
  } catch (error) {
    console.error("[nlite] PPR resume failed", error);
    return createRuntimeResponse();
  }
}

async function loadPrerenderedRscRoute(renderRequest: ReturnType<typeof parseRenderRequest>) {
  const postponedResponse = await fetch(
    new URL(`/${normalizePostponedFilePath(renderRequest.pathname)}`, renderRequest.url),
  );

  if (postponedResponse.status === 404) {
    const staticResponse = await fetch(
      new URL(`/${normalizeRscFilePath(renderRequest.pathname)}`, renderRequest.url),
    );
    return staticResponse.ok ? staticResponse : undefined;
  }

  if (!postponedResponse.ok) {
    return undefined;
  }

  const shellResponse = await fetch(
    new URL(`/${normalizeRscFilePath(renderRequest.pathname)}`, renderRequest.url),
  );
  if (!shellResponse.ok) {
    return undefined;
  }

  const match = matchRoute(routes, renderRequest.pathname);
  if (!match) {
    return undefined;
  }

  const runtimeRscStream = createRscStream(match, renderRequest);
  return new Response(concatStreams(shellResponse.body, runtimeRscStream), {
    headers: { "content-type": "text/x-component;charset=utf-8" },
  });
}

function createRscStream(
  match: NonNullable<ReturnType<typeof matchRoute>>,
  renderRequest: ReturnType<typeof parseRenderRequest>,
) {
  const app = createRouteElement(match.route, match.params, renderRequest.url.searchParams);
  const documentNode = React.createElement(Document, {
    children: app,
    pathname: renderRequest.pathname,
  });
  return renderToReadableStream<RscPayload>({ root: documentNode });
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const trailer = "</body></html>";

async function streamToChunks(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      return chunks;
    }
    chunks.push(value);
  }
}

function createUnclosingStream(chunks: Uint8Array[]) {
  let index = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index < chunks.length) {
        controller.enqueue(chunks[index++]);
      }
    },
  });
}

function createClosingStream(chunks: Uint8Array[]) {
  let index = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index < chunks.length) {
        controller.enqueue(chunks[index++]);
        return;
      }
      controller.close();
    },
  });
}

function concatHtmlStreams(
  shell: ReadableStream<Uint8Array> | null,
  resumeStream: ReadableStream<Uint8Array>,
) {
  return concatStreams(shell, resumeStream, true);
}

function concatStreams(
  shell: ReadableStream<Uint8Array> | null,
  resumeStream: ReadableStream<Uint8Array>,
  stripHtmlTrailer = false,
) {
  if (!shell) {
    return resumeStream;
  }

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        if (stripHtmlTrailer) {
          await writeStreamWithoutTrailingHtml(shell, controller);
        } else {
          await writeStream(shell, controller);
        }
        await writeStream(resumeStream, controller);
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });
}

async function writeStreamWithoutTrailingHtml(
  stream: ReadableStream<Uint8Array>,
  controller: ReadableStreamDefaultController<Uint8Array>,
) {
  const reader = stream.getReader();
  let text = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    text += decoder.decode(value, { stream: true });
  }

  text += decoder.decode();
  controller.enqueue(
    encoder.encode(text.endsWith(trailer) ? text.slice(0, -trailer.length) : text),
  );
}

async function writeStream(
  stream: ReadableStream<Uint8Array>,
  controller: ReadableStreamDefaultController<Uint8Array>,
) {
  const reader = stream.getReader();

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    controller.enqueue(value);
  }
}
