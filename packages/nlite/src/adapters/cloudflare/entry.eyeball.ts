import { RESUME_HEADER, RSC_POSTFIX, STALE_TIME_HEADER } from "../../utils/constants.js";
import {
  normalizeHtmlFilePath,
  normalizeMetaFilePath,
  normalizeRoutePath,
} from "../../utils/path.js";

export interface EyeballEnv {
  ASSETS: { fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> };
  ORIGIN: { fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> };
}

interface PrerenderMetaFile {
  renderingMode?: string;
  postponed?: unknown;
}

export default {
  async fetch(request: Request, env: EyeballEnv): Promise<Response> {
    if (request.headers.get(RESUME_HEADER) === "1") {
      return env.ORIGIN.fetch(request);
    }

    if (request.method === "GET" || request.method === "HEAD") {
      const stitched = await tryPprStitch(request, env);
      if (stitched) {
        return stitched;
      }

      const assetResponse = await env.ASSETS.fetch(request);
      if (assetResponse.status !== 404) {
        return assetResponse;
      }
    }

    return env.ORIGIN.fetch(request);
  },
};

async function tryPprStitch(request: Request, env: EyeballEnv): Promise<Response | null> {
  const url = new URL(request.url);
  if (!shouldConsiderPpr(url.pathname)) {
    return null;
  }

  const routePath = routePathFromUrl(url.pathname);
  const metaResponse = await env.ASSETS.fetch(assetRequest(request, metaAssetPath(routePath)));
  if (!metaResponse.ok) {
    return null;
  }

  const metaText = await metaResponse.text();
  let meta: PrerenderMetaFile;
  try {
    meta = JSON.parse(metaText) as PrerenderMetaFile;
  } catch {
    return null;
  }

  if (meta.renderingMode !== "PARTIALLY_STATIC" || meta.postponed == null) {
    return null;
  }

  const isRsc = url.pathname.endsWith(RSC_POSTFIX);

  if (isRsc) {
    return env.ORIGIN.fetch(createResumeRequest(request, metaText));
  }

  const shellResponse = await env.ASSETS.fetch(
    assetRequest(request, `/${normalizeHtmlFilePath(routePath)}`),
  );
  if (!shellResponse.ok || !shellResponse.body) {
    return env.ORIGIN.fetch(request);
  }

  if (request.method === "HEAD") {
    return new Response(null, {
      status: shellResponse.status,
      headers: stripBodyHeaders(shellResponse.headers),
    });
  }

  const resumePromise = env.ORIGIN.fetch(createResumeRequest(request, metaText));
  const body = concatStreams(shellResponse.body, async () => {
    const resumeResponse = await resumePromise;
    if (!resumeResponse.ok || !resumeResponse.body) {
      throw new Error(
        `[nlite] PPR resume failed with status ${resumeResponse.status} for ${routePath}`,
      );
    }
    return resumeResponse.body;
  });

  const headers = new Headers({
    "content-type": "text/html;charset=utf-8",
  });
  headers.set(STALE_TIME_HEADER, String(__NLITE_STALE_TIMES__.dynamic));

  return new Response(body, { status: 200, headers });
}

function shouldConsiderPpr(pathname: string) {
  if (pathname.startsWith("/_nlite/")) {
    return false;
  }

  const lastSegment = pathname.split("/").pop() ?? "";
  if (
    lastSegment.includes(".") &&
    !lastSegment.endsWith(".html") &&
    !lastSegment.endsWith(RSC_POSTFIX)
  ) {
    return false;
  }

  return true;
}

function routePathFromUrl(pathname: string) {
  if (pathname.endsWith(RSC_POSTFIX)) {
    return normalizeRoutePath(pathname.slice(0, -RSC_POSTFIX.length) || "/");
  }

  if (pathname.endsWith(".html")) {
    if (pathname === "/index.html") {
      return "/";
    }
    return normalizeRoutePath(pathname.slice(0, -".html".length));
  }

  return normalizeRoutePath(pathname);
}

function metaAssetPath(routePath: string) {
  return `/${normalizeMetaFilePath(routePath)}`;
}

function assetRequest(request: Request, pathname: string) {
  const url = new URL(request.url);
  url.pathname = pathname;
  url.search = "";
  return new Request(url, { method: "GET" });
}

function createResumeRequest(request: Request, metaText: string) {
  const headers = new Headers();
  request.headers.forEach((value, name) => {
    if (HOP_BY_HOP_HEADERS.has(name.toLowerCase())) {
      return;
    }
    headers.set(name, value);
  });
  headers.set(RESUME_HEADER, "1");
  headers.delete("content-length");

  return new Request(request.url, {
    method: "POST",
    headers,
    body: metaText,
  });
}

function concatStreams(
  head: ReadableStream<Uint8Array>,
  getTail: () => Promise<ReadableStream<Uint8Array>>,
) {
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        await pump(head, controller);
        const tail = await getTail();
        await pump(tail, controller);
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });
}

async function pump(
  stream: ReadableStream<Uint8Array>,
  controller: ReadableStreamDefaultController<Uint8Array>,
) {
  const reader = stream.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      controller.enqueue(value);
    }
  } finally {
    reader.releaseLock();
  }
}

function stripBodyHeaders(headers: Headers) {
  const next = new Headers(headers);
  next.delete("content-length");
  next.delete("content-encoding");
  next.delete("transfer-encoding");
  return next;
}

const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
  "content-length",
  "host",
]);
