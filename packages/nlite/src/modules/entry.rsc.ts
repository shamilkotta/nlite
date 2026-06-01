import React from "react";
import { renderToReadableStream } from "@vitejs/plugin-rsc/rsc";
import { prerender } from "@vitejs/plugin-rsc/vendor/react-server-dom/static.edge";
import { createClientManifest } from "@vitejs/plugin-rsc/core/rsc";
import routes from "virtual:nlite/routes";
import { collectStaticPaths, createRouteElement, matchRoute } from "../runtime.js";
import { runWithRequestContext, withTrackedFetch } from "../internal/request-context.js";
import type { RscPayload } from "../types.js";
import { STALE_TIME_HEADER } from "../utils/constants.js";
import { tryCatch } from "../utils/index.js";

type WorkerEnv = {
  ASSETS?: {
    fetch(request: Request): Promise<Response>;
  };
};

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
      React.createElement("link", {
        rel: "icon",
        href: "/favicon.ico",
        sizes: "any",
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

export async function handler(request: Request, env?: WorkerEnv) {
  const url = new URL(request.url);
  const pathname = url.pathname;

  const apiEntry = await import.meta.viteRsc.loadModule<typeof import("virtual:nlite/api")>(
    "api",
    "index",
  );
  if (apiEntry.apiHandler && apiEntry.couldMatchApi(pathname)) {
    return apiEntry.apiHandler(request);
  }

  const renderRequest = parseRenderRequest(request, pathname);
  const match = matchRoute(routes, renderRequest.pathname);

  if (!match) {
    if (env?.ASSETS) {
      // TODO: serve 404 page from assets
      return env.ASSETS.fetch(new Request(`/404.html`, request));
    }

    return new Response("Not Found", {
      status: 404,
      headers: { "content-type": "text/plain;charset=utf-8" },
    });
  }

  const rscStream = runWithRequestContext(
    request,
    () => {
      const app = createRouteElement(match.route, match.params, url.searchParams);
      const documentNode = React.createElement(Document, {
        children: app,
        pathname,
      });
      const rscPayload = { root: documentNode };
      return renderToReadableStream<RscPayload>(rscPayload);
    },
    { searchParams: url.searchParams },
  );

  if (renderRequest.isRsc) {
    return new Response(rscStream, {
      headers: {
        "content-type": "text/x-component;charset=utf-8",
        [STALE_TIME_HEADER]: String(getRouteStaleTimeSeconds(match.route)),
      },
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

export default { fetch: handler };

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

class DynamicPrerenderUsageError extends Error {
  constructor() {
    super("Route used request-bound data during prerender");
    this.name = "DynamicPrerenderUsageError";
  }
}

export async function collectPrerenderPaths() {
  return collectStaticPaths(routes);
}

export async function handlePrerender(
  request: Request,
  options: {
    forcePrerender?: boolean;
    onDynamicUsage?: () => void;
  },
) {
  const renderRequest = parseRenderRequest(request);
  const match = matchRoute(routes, renderRequest.pathname);

  if (!match) {
    throw new Error('Cannot prerender unknown route "' + renderRequest.pathname + '"');
  }

  const controller = new AbortController();
  const dynamicUsage = new DynamicPrerenderUsageError();
  const [prerenderResult, error] = await tryCatch(
    runWithRequestContext(
      request,
      () =>
        withTrackedFetch(() => {
          const app = createRouteElement(match.route, match.params, renderRequest.url.searchParams);
          const documentNode = React.createElement(Document, {
            children: app,
            pathname: renderRequest.pathname,
          });
          const rscPayload = { root: documentNode };

          return prerender<RscPayload>(rscPayload, createClientManifest(), {
            signal: controller.signal,
            onError: (error) => {
              if (error instanceof DynamicPrerenderUsageError) {
                return;
              }

              throw error;
            },
          });
        }),
      {
        searchParams: renderRequest.url.searchParams,
        onDynamicUsage() {
          if (!options.forcePrerender) {
            options.onDynamicUsage?.();
            controller.abort(dynamicUsage);
          }
        },
      },
    ),
  );

  if (error) {
    if (error instanceof DynamicPrerenderUsageError) {
      return { stream: null, rsc: null, skip: true };
    }
    throw error;
  }

  if (controller.signal.aborted && controller.signal.reason instanceof DynamicPrerenderUsageError) {
    return { stream: null, rsc: null, skip: true };
  }

  if (!prerenderResult || !prerenderResult?.prelude) {
    return { stream: null, rsc: null, skip: true };
  }
  const rscStream = prerenderResult.prelude;

  const ssrEntry = await import.meta.viteRsc.loadModule<typeof import("./entry.ssr.ts")>(
    "ssr",
    "index",
  );
  const [rscStream1, rscStream2] = rscStream.tee();
  const { stream: htmlStream } = await ssrEntry.renderHtml(rscStream1, { ssg: true });
  return { stream: htmlStream, rsc: rscStream2, skip: false };
}

function parseRenderRequest(request: Request, pathname = new URL(request.url).pathname) {
  const url = new URL(request.url);
  const pagePathname = toRscPathname(pathname);

  return {
    isRsc: pathname.endsWith(".rsc"),
    pathname: pagePathname,
    url,
  };
}

// TODO: its not right, not taking account of dynamic ssg
function getRouteStaleTimeSeconds(route: (typeof routes)[number]) {
  if (route.rendering === "force-ssg") {
    return __NLITE_STALE_TIMES__.static;
  }

  return __NLITE_STALE_TIMES__.dynamic;
}
