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
import { DynamicPrerenderUsageError, runWithRequestContext } from "../internal/request-context.js";
import {
  CacheSignal,
  PrerenderCache,
  type SerializedPrerenderCache,
} from "../internal/prerender-cache.js";
import { isNliteRouterError } from "../lib/navigation/errors.js";
import type { RscPayload, NliteHandlerEnv, PrerenderMeta } from "../types.js";
import type { PostponedState } from "react-dom/static";
import { NEXT_RESUME_HEADER } from "../adapters/vercel/constants.js";
import {
  NOT_FOUND_ROUTE_PATH,
  PARTIAL_HEADER,
  PREFETCH_HEADER,
  RESPONSE_STATUS_HEADER,
  RESUME_HEADER,
  STALE_TIME_HEADER,
} from "../utils/constants.js";
import { tryCatch } from "../utils/index.js";
import { teeRscStream } from "../utils/stream.js";
import { runInSequentialTasks } from "../utils/scheduler.js";
import { resolveRouteMetadata } from "../utils/metadata/index.js";

function onRscError(error: unknown) {
  if (isNliteRouterError(error)) {
    return error.digest;
  }

  if (DynamicPrerenderUsageError.isInstance(error)) {
    return;
  }

  if (import.meta.env.DEV) {
    return (error as Error).message;
  }

  console.error(error);
  return hashDigest(String(error));
}

function hashDigest(value: string) {
  let hash = 5381;
  for (let index = 0; index < value.length; index++) {
    hash = ((hash << 5) + hash + value.charCodeAt(index)) | 0;
  }
  return String(hash >>> 0);
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

  if (!match) return notFoundHandler(request, env);

  if (isResumeRequest(request)) {
    const meta = await loadPrerenderMeta(request);
    if (!meta?.postponed) return new Response(null, { status: 204 });
    return resumeRenderResponse(request, match, renderRequest, meta as PrerenderMeta);
  }

  if (renderRequest.isRsc && request.headers.get(PREFETCH_HEADER) === "1") {
    return prefetchRenderResponse(request, match, renderRequest);
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

async function notFoundHandler(request: Request, env?: NliteHandlerEnv) {
  const url = new URL(request.url);
  const pathname = url.pathname;
  const renderRequest = parseRenderRequest(request, pathname);
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
      const metadata = await resolveGlobalNotFoundMetadata(routes, renderRequest.url.searchParams);
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

async function prefetchRenderResponse(
  request: Request,
  match: NonNullable<ReturnType<typeof matchRoute>>,
  renderRequest: ReturnType<typeof parseRenderRequest>,
) {
  const { prelude } = await prerenderFlight(match, renderRequest, request, { partial: true });
  const headers = {
    vary: PREFETCH_HEADER,
    [STALE_TIME_HEADER]: String(__NLITE_STALE_TIMES__.static),
    [PARTIAL_HEADER]: "1",
  };

  if (!prelude) {
    return new Response(null, { status: 204, headers });
  }

  return new Response(prelude, {
    status: 200,
    headers: {
      ...headers,
      "content-type": "text/x-component;charset=utf-8",
      [RESPONSE_STATUS_HEADER]: "200",
    },
  });
}

async function resumeRenderResponse(
  request: Request,
  match: NonNullable<ReturnType<typeof matchRoute>>,
  renderRequest: ReturnType<typeof parseRenderRequest>,
  meta: PrerenderMeta,
) {
  const url = new URL(request.url);
  const resumed = await runWithRequestContext(
    request,
    async () => {
      const metadata = await resolveRouteMetadata(match.route, match.params, url.searchParams);
      const app = createRouteElement(match.route, match.params, renderRequest.url.searchParams);
      const rscStream = renderToReadableStream<RscPayload>(
        { root: app, metadata },
        { onError: onRscError },
      );

      if (renderRequest.isRsc) {
        return { stream: rscStream, status: 200, isRsc: true as const };
      }

      const ssrEntry = await import.meta.viteRsc.loadModule<typeof import("./entry.ssr.ts")>(
        "ssr",
        "index",
      );
      const html = await ssrEntry.resumeHtml(rscStream, meta.postponed, {
        url: renderRequest.url,
      });
      return { stream: html.stream, status: html.status ?? 200, isRsc: false as const };
    },
    { cache: meta.cache, searchParams: renderRequest.url.searchParams },
  );

  if (resumed.isRsc) {
    return new Response(resumed.stream, {
      status: 200,
      headers: {
        "content-type": "text/x-component;charset=utf-8",
        [STALE_TIME_HEADER]: String(__NLITE_STALE_TIMES__.dynamic),
        [RESPONSE_STATUS_HEADER]: String(200),
      },
    });
  }

  const htmlStream = resumed.stream;
  const renderStatus = resumed.status;

  return new Response(htmlStream, {
    status: renderStatus ?? 200,
    headers: {
      "content-type": "text/html;charset=utf-8",
      [STALE_TIME_HEADER]: String(__NLITE_STALE_TIMES__.dynamic),
    },
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
        vary: PREFETCH_HEADER,
        [STALE_TIME_HEADER]: String(__NLITE_STALE_TIMES__.dynamic),
        [RESPONSE_STATUS_HEADER]: String(responseStatus),
      },
    });
  }

  const ssrEntry = await import.meta.viteRsc.loadModule<typeof import("./entry.ssr.ts")>(
    "ssr",
    "index",
  );
  const {
    stream: htmlStream,
    status: renderStatus,
    redirect,
  } = await ssrEntry.renderHtml(rscStream, {
    ssg: false,
    url: options.renderRequest.url,
  });

  const headers: Record<string, string> = {
    "content-type": "text/html;charset=utf-8",
    [STALE_TIME_HEADER]: String(__NLITE_STALE_TIMES__.dynamic),
  };
  if (redirect) headers.location = redirect.url;

  return new Response(htmlStream, {
    status: redirect?.status ?? renderStatus ?? httpStatus,
    headers,
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
    ppr?: boolean;
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

type PrerenderResult =
  | {
      skip: true;
    }
  | (Awaited<ReturnType<typeof finalizePrerenderResult>> & {
      cache?: SerializedPrerenderCache;
      skip: false;
    });

async function prerenderRoute(
  match: NonNullable<ReturnType<typeof matchRoute>>,
  renderRequest: ReturnType<typeof parseRenderRequest>,
  request: Request,
  options: {
    ppr?: boolean;
    forcePrerender?: boolean;
    onDynamicUsage?: () => void;
  },
): Promise<PrerenderResult> {
  const flight = await prerenderFlight(match, renderRequest, request, {
    partial: Boolean(options.ppr) && !options.forcePrerender,
    forcePrerender: options.forcePrerender,
    onDynamicUsage: options.onDynamicUsage,
  });

  if (!flight.prelude || (flight.dynamicAbort && !options.ppr)) {
    return { skip: true };
  }

  const result = await finalizePrerenderResult(flight.prelude, renderRequest.url, {
    abort: flight.halted,
  });

  return { ...result, cache: await flight.cache.serialize(), skip: false };
}

async function prerenderFlight(
  match: NonNullable<ReturnType<typeof matchRoute>>,
  renderRequest: ReturnType<typeof parseRenderRequest>,
  request: Request,
  options: {
    partial: boolean;
    forcePrerender?: boolean;
    onDynamicUsage?: () => void;
  },
) {
  const dynamicUsage = new DynamicPrerenderUsageError();
  const { route, params } = match;
  const searchParams = renderRequest.url.searchParams;
  const cache = new PrerenderCache();

  const renderFlight = async (signal: AbortSignal) => {
    const metadata = await resolveRouteMetadata(route, params, searchParams);
    const app = createRouteElement(route, params, searchParams);
    return prerender<RscPayload>({ root: app, metadata }, createClientManifest(), {
      signal,
      onError: onRscError,
    });
  };

  if (options.partial) {
    const cacheSignal = new CacheSignal();
    const prospectiveController = new AbortController();
    const pendingProspectiveRender = runWithRequestContext(
      request,
      () => renderFlight(prospectiveController.signal),
      {
        cache,
        cacheSignal,
        searchParams,
        signal: prospectiveController.signal,
        deferDynamic: true,
      },
    );

    await cacheSignal.ready();
    prospectiveController.abort(dynamicUsage);

    const [, prospectiveError] = await tryCatch(pendingProspectiveRender);
    if (prospectiveError && !DynamicPrerenderUsageError.isInstance(prospectiveError)) {
      throw prospectiveError;
    }
  }

  const controller = new AbortController();
  let halted = false;

  const [prerenderResult, prerenderError] = await tryCatch(
    runWithRequestContext(
      request,
      () => {
        if (!options.partial) return renderFlight(controller.signal);

        let flightPending = true;
        return runInSequentialTasks(
          () => {
            const pending = renderFlight(controller.signal);
            const settle = () => {
              flightPending = false;
            };
            void pending.then(settle, settle);
            return pending;
          },
          () => {
            if (flightPending && !controller.signal.aborted) {
              halted = true;
              controller.abort(dynamicUsage);
            }
          },
        );
      },
      {
        cache,
        searchParams,
        signal: controller.signal,
        deferDynamic: options.partial,
        onDynamicUsage() {
          if (options.forcePrerender) return;
          options.onDynamicUsage?.();
          if (!options.partial) controller.abort(dynamicUsage);
        },
      },
    ),
  );

  if (prerenderError && !DynamicPrerenderUsageError.isInstance(prerenderError)) {
    throw prerenderError;
  }

  return {
    prelude: prerenderResult?.prelude,
    halted,
    dynamicAbort:
      controller.signal.aborted && DynamicPrerenderUsageError.isInstance(controller.signal.reason),
    cache,
  };
}

async function finalizePrerenderResult(
  rscStream: ReadableStream,
  url: URL,
  options: { abort?: boolean } = {},
) {
  const ssrEntry = await import.meta.viteRsc.loadModule<typeof import("./entry.ssr.ts")>(
    "ssr",
    "index",
  );
  const [rscStream1, rscStream2] = await teeRscStream(rscStream);
  const { stream: htmlStream, postponed } = await ssrEntry.renderHtml(rscStream1, {
    ssg: true,
    url,
    abort: options.abort,
  });
  return { stream: htmlStream, rsc: rscStream2, postponed };
}

// TODO: revisit here
export async function handleGlobalNotFoundPrerender(
  request: Request,
  options: {
    onDynamicUsage?: () => void;
  },
): Promise<PrerenderResult> {
  const renderRequest = parseRenderRequest(request);
  const controller = new AbortController();
  const dynamicUsage = new DynamicPrerenderUsageError();
  const prerenderResult = await runWithRequestContext(
    request,
    async () => {
      const metadata = await resolveGlobalNotFoundMetadata(routes, renderRequest.url.searchParams);
      const app = createGlobalNotFoundElement(routes, renderRequest.url.searchParams);

      return prerender<RscPayload>({ root: app, metadata }, createClientManifest(), {
        signal: controller.signal,
        onError: (error: unknown) => {
          if (error instanceof DynamicPrerenderUsageError) {
            return;
          }

          throw error;
        },
      });
    },
    {
      searchParams: renderRequest.url.searchParams,
      signal: controller.signal,
      onDynamicUsage() {
        controller.abort(dynamicUsage);
        options.onDynamicUsage?.();
      },
    },
  );

  if (controller.signal.aborted && controller.signal.reason instanceof DynamicPrerenderUsageError) {
    return { skip: true };
  }

  if (!prerenderResult?.prelude) {
    return { skip: true };
  }
  const result = await finalizePrerenderResult(prerenderResult.prelude, renderRequest.url);
  return { ...result, skip: false };
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

function isResumeRequest(request: Request) {
  if (request.method !== "POST") {
    return false;
  }

  // Accept both nlite-local and Vercel CDN chain headers.
  return (
    request.headers.get(RESUME_HEADER) === "1" || request.headers.get(NEXT_RESUME_HEADER) === "1"
  );
}

async function loadPrerenderMeta(request: Request) {
  const body = await request.text();
  try {
    const meata = JSON.parse(body) as {
      cache?: SerializedPrerenderCache;
      postponed?: PostponedState;
    };
    return {
      cache: new PrerenderCache(meata.cache),
      postponed: meata.postponed,
    };
  } catch {
    return;
  }
}
