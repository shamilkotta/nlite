import React from "react";
import { renderToReadableStream } from "@vitejs/plugin-rsc/rsc";
import { prerender } from "@vitejs/plugin-rsc/vendor/react-server-dom/static.edge";
import { createClientManifest } from "@vitejs/plugin-rsc/core/rsc";
import routes from "virtual:nlite/routes";
import { collectStaticPaths, createRouteElement, matchRoute } from "../runtime.js";
import type { RscPayload } from "../types.js";
import { normalizeHtmlFilePath, normalizeRscFilePath } from "../utils/path.js";

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
  const url = new URL(request.url);
  const renderRequest = parseRenderRequest(request);
  const pathname = renderRequest.pathname;
  const match = matchRoute(routes, pathname);

  if (!match) {
    return new Response("Not Found", {
      status: 404,
      headers: { "content-type": "text/plain;charset=utf-8" },
    });
  }

  const app = createRouteElement(match.route, match.params, url.searchParams);
  const documentNode = React.createElement(Document, {
    children: app,
    pathname,
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
  const { stream: htmlStream, status } = await ssrEntry.renderHtml(rscStream, { ssg: false });

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

class PrerenderAsyncAbortError extends Error {
  constructor() {
    super("Prerender async abort");
    this.name = "PrerenderAsyncAbortError";
  }
}

function isPrerenderAsyncAbortError(error: unknown, reason: PrerenderAsyncAbortError) {
  return error === reason || (error instanceof Error && error.name === reason.name);
}

export async function collectPrerenderPaths() {
  return collectStaticPaths(routes);
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

  const { prelude: rscStream } = await prerender<RscPayload>(rscPayload, createClientManifest(), {
    onError: (error) => {
      throw error;
    },
  });

  if (!rscStream) {
    return { stream: null, rsc: null, skip: true };
  }

  const ssrEntry = await import.meta.viteRsc.loadModule<typeof import("./entry.ssr.ts")>(
    "ssr",
    "index",
  );
  const [rscStream1, rscStream2] = rscStream.tee();
  const { stream: htmlStream } = await ssrEntry.renderHtml(rscStream1, { ssg: true });
  return { stream: htmlStream, rsc: rscStream2, skip: false };
}

export async function probePrerender(request: Request) {
  const renderRequest = parseRenderRequest(request);
  const match = matchRoute(routes, renderRequest.pathname);

  if (!match) {
    throw new Error('Cannot probe unknown route "' + renderRequest.pathname + '"');
  }

  if (match.route.rendering === "force-ssr") {
    return false;
  }

  if (match.route.rendering === "force-ssg") {
    return true;
  }

  const app = createRouteElement(match.route, match.params, renderRequest.url.searchParams);
  const documentNode = React.createElement(Document, {
    children: app,
    pathname: renderRequest.pathname,
  });
  const rscPayload = { root: documentNode };
  const controller = new AbortController();
  const reason = new PrerenderAsyncAbortError();
  let settled = false;
  let rejected: unknown;

  void prerender<RscPayload>(rscPayload, createClientManifest(), {
    signal: controller.signal,
    onError: (error) => {
      if (isPrerenderAsyncAbortError(error, reason)) {
        return;
      }

      throw error;
    },
  }).then(
    () => {
      settled = true;
    },
    (error) => {
      settled = true;
      rejected = error;
    },
  );

  await new Promise<void>((resolve) => {
    setImmediate(() => {
      controller.abort(reason);
      resolve();
    });
  });

  if (!settled) {
    return false;
  }

  if (rejected) {
    if (isPrerenderAsyncAbortError(rejected, reason)) {
      return false;
    }

    throw rejected;
  }

  return true;
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

async function loadPrerenderedRoute(renderRequest: { isRsc: boolean; pathname: string; url: URL }) {
  const staticUrl = new URL(
    renderRequest.isRsc
      ? `/${normalizeRscFilePath(renderRequest.pathname)}`
      : `/${normalizeHtmlFilePath(renderRequest.pathname)}`,
    renderRequest.url,
  );

  const staticResponse = await fetch(staticUrl);
  if (staticResponse.ok) {
    return staticResponse;
  }

  if (staticResponse.status === 404) {
    return new Response("Not Found", {
      status: 404,
      headers: { "content-type": "text/plain;charset=utf-8" },
    });
  }

  return staticResponse;
}
