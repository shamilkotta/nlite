import { renderToReadableStream } from "@vitejs/plugin-rsc/rsc";
import { prerender } from "@vitejs/plugin-rsc/vendor/react-server-dom/static.edge";
import { createClientManifest } from "@vitejs/plugin-rsc/core/rsc";
import routes from "virtual:nlite/routes";
import {
  collectStaticPaths,
  createGlobalNotFoundElement,
  createRouteElement,
  matchRoute,
  resolveGlobalNotFoundMetadata,
} from "../runtime.js";
import {
  DynamicPrerenderUsageError,
  isContextError,
  runWithRequestContext,
  withTrackedFetch,
} from "../internal/request-context.js";
import { isNliteRouterError } from "../lib/navigation/errors.js";
import type { RscPayload, NliteHandlerEnv } from "../types.js";
import {
  NOT_FOUND_ROUTE_PATH,
  RESPONSE_STATUS_HEADER,
  STALE_TIME_HEADER,
} from "../utils/constants.js";
import { tryCatch } from "../utils/index.js";
import { teeRscStream } from "../utils/stream.js";
import { resolveRouteMetadata } from "../utils/metadata/index.js";

function onRscError(error: unknown) {
  if (isNliteRouterError(error)) {
    return error.digest;
  }

  if (isContextError(error)) {
    return;
  }

  throw error;
}

export async function handler(request: Request, env?: NliteHandlerEnv) {
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

  if (renderRequest.pathname === NOT_FOUND_ROUTE_PATH) {
    return new Response(null, { status: 404 });
  }

  const match = matchRoute(routes, renderRequest.pathname);

  if (!match) {
    if (!renderRequest.isRsc && !isDocumentRenderRequest(request, pathname)) {
      return new Response(null, { status: 404 });
    }

    const notFoundUrl = new URL(
      NOT_FOUND_ROUTE_PATH + (renderRequest.isRsc ? ".rsc" : ""),
      request.url,
    );

    const assetResponse = await env?.ASSETS?.fetch(new Request(notFoundUrl, request));
    if (assetResponse?.ok) {
      const headers = new Headers({
        "content-type": renderRequest.isRsc
          ? "text/x-component;charset=utf-8"
          : "text/html;charset=utf-8",
        [STALE_TIME_HEADER]:
          assetResponse.headers.get(STALE_TIME_HEADER) ?? String(__NLITE_STALE_TIMES__.dynamic),
      });

      return new Response(assetResponse.body, {
        status: 404,
        headers,
      });
    }

    const stream = await runWithRequestContext(
      request,
      async () => {
        const metadata = await resolveGlobalNotFoundMetadata(
          routes,
          renderRequest.url.searchParams,
        );
        const app = createGlobalNotFoundElement(routes, renderRequest.url.searchParams);
        return renderToReadableStream<RscPayload>(
          { root: app, metadata },
          {
            onError: (error: unknown) => {
              throw error;
            },
          },
        );
      },
      { searchParams: url.searchParams },
    );

    return finalizeRenderResponse(stream, {
      renderRequest,
      status: 404,
    });
  }

  const stream = await runWithRequestContext(
    request,
    async () => {
      const metadata = await resolveRouteMetadata(match.route, match.params, url.searchParams);
      const app = createRouteElement(match.route, match.params, url.searchParams);
      return renderToReadableStream<RscPayload>({ root: app, metadata }, { onError: onRscError });
    },
    { searchParams: url.searchParams },
  );

  return finalizeRenderResponse(stream, {
    renderRequest,
    status: 200,
  });
}

async function finalizeRenderResponse(
  rscStream: ReadableStream,
  options: {
    renderRequest: ReturnType<typeof parseRenderRequest>;
    status?: number;
    responseStatus?: number;
  },
) {
  const httpStatus = options.status ?? 200;
  const responseStatus = options.responseStatus ?? httpStatus;

  if (options.renderRequest.isRsc) {
    return new Response(rscStream, {
      status: httpStatus,
      headers: {
        "content-type": "text/x-component;charset=utf-8",
        [STALE_TIME_HEADER]: String(__NLITE_STALE_TIMES__.dynamic),
        [RESPONSE_STATUS_HEADER]: String(responseStatus),
      },
    });
  }

  const ssrEntry = await import.meta.viteRsc.loadModule<typeof import("./entry.ssr.ts")>(
    "ssr",
    "index",
  );
  const { stream: htmlStream, status: renderStatus } = await ssrEntry.renderHtml(rscStream, {
    ssg: false,
    url: options.renderRequest.url,
  });

  return new Response(htmlStream, {
    status: renderStatus ?? httpStatus,
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
    prerenderRoute(match, renderRequest, request, {
      ...options,
    }),
  );

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
  const { route, params } = match;
  const prerenderResult = await runWithRequestContext(
    request,
    () =>
      withTrackedFetch(async () => {
        const metadata = await resolveRouteMetadata(route, params, renderRequest.url.searchParams);
        const app = createRouteElement(route, params, renderRequest.url.searchParams);
        return prerender<RscPayload>({ root: app, metadata }, createClientManifest(), {
          signal: controller.signal,
          onError: onRscError,
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
  );

  if (controller.signal.aborted && controller.signal.reason instanceof DynamicPrerenderUsageError) {
    return { stream: null, rsc: null, skip: true };
  }

  if (!prerenderResult?.prelude) {
    return { stream: null, rsc: null, skip: true };
  }

  return finalizePrerenderResult(prerenderResult.prelude, renderRequest.url);
}

async function finalizePrerenderResult(rscStream: ReadableStream, url: URL) {
  const ssrEntry = await import.meta.viteRsc.loadModule<typeof import("./entry.ssr.ts")>(
    "ssr",
    "index",
  );
  const [rscStream1, rscStream2] = await teeRscStream(rscStream);
  const { stream: htmlStream } = await ssrEntry.renderHtml(rscStream1, { ssg: true, url });
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
  const prerenderResult = await runWithRequestContext(
    request,
    () =>
      withTrackedFetch(async () => {
        const metadata = await resolveGlobalNotFoundMetadata(
          routes,
          renderRequest.url.searchParams,
        );
        const app = createGlobalNotFoundElement(routes, renderRequest.url.searchParams);

        return prerender<RscPayload>({ root: app, metadata }, createClientManifest(), {
          onError: (error: unknown) => {
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
  );

  if (!prerenderResult?.prelude) {
    return { stream: null, rsc: null, skip: true };
  }
  return finalizePrerenderResult(prerenderResult.prelude, renderRequest.url);
}

function isDocumentRenderRequest(request: Request, pathname: string) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return false;
  }

  const accept = request.headers.get("accept") ?? "";
  const acceptsHtml = !accept || accept.includes("text/html") || accept.includes("*/*");
  if (!acceptsHtml) {
    return false;
  }

  const lastSegment = pathname.split("/").pop();
  if (lastSegment?.includes(".")) {
    return false;
  }

  return true;
}

function parseRenderRequest(request: Request, pathname = new URL(request.url).pathname) {
  const url = new URL(request.url);
  const pagePathname = pathname.endsWith(".rsc") ? pathname.slice(0, -4) || "/" : pathname;

  return {
    isRsc: pathname.endsWith(".rsc"),
    pathname: pagePathname,
    url,
  };
}
