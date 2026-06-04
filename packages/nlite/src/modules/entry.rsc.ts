import React from "react";
import { renderToReadableStream } from "@vitejs/plugin-rsc/rsc";
import { prerender } from "@vitejs/plugin-rsc/vendor/react-server-dom/static.edge";
import { createClientManifest } from "@vitejs/plugin-rsc/core/rsc";
import routes from "virtual:nlite/routes";
import {
  collectStaticPaths,
  createGlobalNotFoundElement,
  createRouteElement,
  createRouteNotFoundElement,
  matchRoute,
} from "../runtime.js";
import { runWithRequestContext, withTrackedFetch } from "../internal/request-context.js";
import {
  getRedirectStatusCodeFromError,
  getURLFromRedirectError,
  isNotFoundError,
  isRedirectError,
} from "../lib/navigation/errors.js";
import type { RscPayload } from "../types.js";
import {
  Document,
  NOT_FOUND_ROUTE_PATH,
  RESPONSE_STATUS_HEADER,
  STALE_TIME_HEADER,
} from "../utils/constants.js";
import { tryCatch } from "../utils/index.js";
import { teeRscStream } from "../utils/stream.js";

type WorkerEnv = {
  ASSETS?: {
    fetch(request: Request): Promise<Response>;
  };
};

function toRscPathname(pathname: string) {
  return pathname.endsWith(".rsc") ? pathname.slice(0, -4) || "/" : pathname;
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

  if (pathname === NOT_FOUND_ROUTE_PATH) {
    const stream = runWithRequestContext(
      request,
      () => {
        const app = createGlobalNotFoundElement(routes, renderRequest.url.searchParams);
        const documentNode = React.createElement(Document, {
          children: app,
          pathname,
        });
        const rscPayload = { root: documentNode };
        return renderToReadableStream<RscPayload>(rscPayload, {
          onError: (error: unknown) => {
            throw error;
          },
        });
      },
      { searchParams: url.searchParams },
    );

    return finalizeRenderResponse(stream, {
      renderRequest,
    });
  }

  const match = matchRoute(routes, renderRequest.pathname);

  if (!match) {
    // TODO: need to set status code to 404
    if (env?.ASSETS) {
      return env.ASSETS.fetch(new Request(NOT_FOUND_ROUTE_PATH, request));
    }
    return fetch(new Request(NOT_FOUND_ROUTE_PATH, request));
  }

  try {
    const stream = runWithRequestContext(
      request,
      () => {
        const app = createRouteElement(match.route, match.params, url.searchParams);
        const documentNode = React.createElement(Document, {
          children: app,
          pathname,
        });
        const rscPayload = { root: documentNode };
        return renderToReadableStream<RscPayload>(rscPayload, {
          onError: (error: unknown) => {
            throw error;
          },
        });
      },
      { searchParams: url.searchParams },
    );

    return finalizeRenderResponse(stream, {
      renderRequest,
    });
  } catch (error) {
    if (error && isNotFoundError(error)) {
      const stream = runWithRequestContext(
        request,
        () => {
          const app = createRouteNotFoundElement(
            match.route,
            match.params,
            renderRequest.url.searchParams,
          );
          const documentNode = React.createElement(Document, {
            children: app,
            pathname,
          });
          const rscPayload = { root: documentNode };
          return renderToReadableStream<RscPayload>(rscPayload, {
            onError: (error: unknown) => {
              throw error;
            },
          });
        },
        { searchParams: url.searchParams },
      );

      return finalizeRenderResponse(stream, {
        renderRequest,
      });
    }

    if (error && isRedirectError(error)) {
      return Response.redirect(
        new URL(getURLFromRedirectError(error), request.url).toString(),
        getRedirectStatusCodeFromError(error),
      );
    }

    throw error;
  }
}

// TODO: response status
// controlled not found: isRsc = 200, isHtml = 404
// uncontrolled not found: isRsc = 404, isHtml = 404
async function finalizeRenderResponse(
  rscStream: ReadableStream,
  options: {
    renderRequest: ReturnType<typeof parseRenderRequest>;
  },
) {
  if (options.renderRequest.isRsc) {
    const status = 200;

    return new Response(rscStream, {
      status,
      headers: {
        "content-type": "text/x-component;charset=utf-8",
        [STALE_TIME_HEADER]: String(__NLITE_STALE_TIMES__.dynamic),
        [RESPONSE_STATUS_HEADER]: String(status),
      },
    });
  }

  const ssrEntry = await import.meta.viteRsc.loadModule<typeof import("./entry.ssr.ts")>(
    "ssr",
    "index",
  );
  const { stream: htmlStream, status } = await ssrEntry.renderHtml(rscStream, {
    ssg: false,
  });

  return new Response(htmlStream, {
    status: status ?? 200,
    headers: {
      "content-type": "text/html;charset=utf-8",
      [STALE_TIME_HEADER]: String(__NLITE_STALE_TIMES__.dynamic),
    },
  });
}

export default { fetch: handler };

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

  const [initialResult, initialError] = await tryCatch(
    prerenderRoute(match, renderRequest, request, options),
  );

  if (initialError && isNotFoundError(initialError)) {
    return prerenderNotFoundRoute(match, renderRequest, request, options);
  }

  if (initialError && isRedirectError(initialError)) {
    return { stream: null, rsc: null, skip: true };
  }

  if (initialError) {
    throw initialError;
  }

  return initialResult;
}

async function prerenderRoute(
  match: NonNullable<ReturnType<typeof matchRoute>>,
  renderRequest: ReturnType<typeof parseRenderRequest>,
  request: Request,
  options: {
    forcePrerender?: boolean;
    onDynamicUsage?: () => void;
  },
) {
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
    throw error;
  }

  if (controller.signal.aborted && controller.signal.reason instanceof DynamicPrerenderUsageError) {
    return { stream: null, rsc: null, skip: true };
  }

  if (!prerenderResult?.prelude) {
    return { stream: null, rsc: null, skip: true };
  }

  return finalizePrerenderResult(prerenderResult.prelude);
}

async function prerenderNotFoundRoute(
  match: NonNullable<ReturnType<typeof matchRoute>>,
  renderRequest: ReturnType<typeof parseRenderRequest>,
  request: Request,
  options: {
    forcePrerender?: boolean;
    onDynamicUsage?: () => void;
  },
) {
  const controller = new AbortController();
  const dynamicUsage = new DynamicPrerenderUsageError();
  const [prerenderResult, error] = await tryCatch(
    runWithRequestContext(
      request,
      () =>
        withTrackedFetch(() => {
          const app = createRouteNotFoundElement(
            match.route,
            match.params,
            renderRequest.url.searchParams,
          );
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
    throw error;
  }

  if (controller.signal.aborted && controller.signal.reason instanceof DynamicPrerenderUsageError) {
    return { stream: null, rsc: null, skip: true };
  }

  if (!prerenderResult?.prelude) {
    return { stream: null, rsc: null, skip: true };
  }

  return finalizePrerenderResult(prerenderResult.prelude);
}

async function finalizePrerenderResult(rscStream: ReadableStream) {
  const ssrEntry = await import.meta.viteRsc.loadModule<typeof import("./entry.ssr.ts")>(
    "ssr",
    "index",
  );
  const [rscStream1, rscStream2] = await teeRscStream(rscStream);
  const { stream: htmlStream } = await ssrEntry.renderHtml(rscStream1, { ssg: true });
  return { stream: htmlStream, rsc: rscStream2, skip: false };
}

export async function handleGlobalNotFoundPrerender(
  request: Request,
  options: {
    onDynamicUsage?: () => void;
  },
) {
  const renderRequest = parseRenderRequest(request);
  const controller = new AbortController();
  const dynamicUsage = new DynamicPrerenderUsageError();

  const [prerenderResult, error] = await tryCatch(
    runWithRequestContext(
      request,
      () =>
        withTrackedFetch(() => {
          const app = createGlobalNotFoundElement(routes, renderRequest.url.searchParams);
          const documentNode = React.createElement(Document, {
            children: app,
            pathname: NOT_FOUND_ROUTE_PATH,
          });
          const rscPayload = { root: documentNode };

          return prerender<RscPayload>(rscPayload, createClientManifest(), {
            onError(error) {
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
          controller.abort(dynamicUsage);
          options.onDynamicUsage?.();
        },
      },
    ),
  );

  if (error) {
    throw error;
  }

  if (!prerenderResult?.prelude) {
    return { stream: null, rsc: null, skip: true };
  }
  return finalizePrerenderResult(prerenderResult.prelude);
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
