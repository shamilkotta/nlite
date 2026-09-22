import { createReadStream, existsSync, statSync, type Stats } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";

export interface StaticFile {
  abs: string;
  stats: Stats;
  headers: Record<string, string | number>;
}

export interface SirvOptions {
  etag?: boolean;
  extensions?: string[];
  /** When false, the file is piped with `{ end: false }` and `Content-Length` is omitted. */
  end?: boolean | ((req: IncomingMessage, file: StaticFile) => boolean);
  setHeaders?: (res: ServerResponse, pathname: string, stats: Stats) => void;
  shouldServe?: (filePath: string) => boolean;
  onFile?: (req: IncomingMessage, res: ServerResponse, file: StaticFile) => void;
  onSent?: (req: IncomingMessage, res: ServerResponse, file: StaticFile) => void | Promise<void>;
}

const MIME_TYPES: Record<string, string> = {
  css: "text/css",
  html: "text/html;charset=utf-8",
  ico: "image/x-icon",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  js: "text/javascript",
  json: "application/json",
  map: "application/json",
  mjs: "text/javascript",
  png: "image/png",
  rsc: "text/x-component;charset=utf-8",
  svg: "image/svg+xml",
  txt: "text/plain;charset=utf-8",
  webp: "image/webp",
  woff2: "font/woff2",
};

/** Local static file server based on sirv, with control over whether the response is closed. */
export function sirv(dir: string, opts: SirvOptions = {}) {
  const root = path.resolve(dir);
  const isEtag = Boolean(opts.etag);
  const extensions = opts.extensions ?? ["html"];

  return function sirvMiddleware(req: IncomingMessage, res: ServerResponse, next?: () => void) {
    if (req.method !== "GET" && req.method !== "HEAD") {
      next?.();
      return;
    }

    const pathname = getPathname(req.url);
    if (pathname == null) {
      next?.();
      return;
    }

    const file = lookupFile(root, pathname, ["", ...extensions], isEtag, opts.shouldServe);
    if (!file) {
      next?.();
      return;
    }

    const shouldEnd = typeof opts.end === "function" ? opts.end(req, file) : (opts.end ?? true);

    if (isEtag && shouldEnd && req.headers["if-none-match"] === file.headers.ETag) {
      res.writeHead(304);
      res.end();
      return;
    }

    opts.setHeaders?.(res, pathname, file.stats);
    opts.onFile?.(req, res, file);
    send(req, res, file, shouldEnd, opts.onSent);
  };
}

function lookupFile(
  root: string,
  pathname: string,
  extensions: string[],
  isEtag: boolean,
  shouldServe?: (filePath: string) => boolean,
) {
  for (const name of assumeNames(pathname, extensions)) {
    const abs = resolveInside(root, name);
    if (!abs || !existsSync(abs) || shouldServe?.(abs) === false) {
      continue;
    }

    const stats = statSync(abs);
    if (stats.isDirectory()) {
      continue;
    }

    return { abs, stats, headers: toHeaders(name, stats, isEtag) };
  }

  return;
}

/** Mirrors sirv `toAssume`: try the exact URI, then `/index`, then each extension. */
function assumeNames(uri: string, extensions: string[]) {
  let pathname = uri;
  if (pathname.endsWith("/")) {
    pathname = pathname.slice(0, -1);
  }

  const names: string[] = [];
  const indexPath = `${pathname}/index`;

  for (const extension of extensions) {
    const suffix = extension ? `.${extension}` : "";
    if (pathname) {
      names.push(pathname + suffix);
    }
    names.push(indexPath + suffix);
  }

  return names;
}

function send(
  req: IncomingMessage,
  res: ServerResponse,
  file: StaticFile,
  shouldEnd: boolean,
  onSent?: (req: IncomingMessage, res: ServerResponse, file: StaticFile) => void | Promise<void>,
) {
  const headers = { ...file.headers };

  for (const key of Object.keys(headers)) {
    const existing = res.getHeader(key);
    if (existing != null) {
      headers[key] = existing as string | number;
    }
  }

  const contentType = res.getHeader("content-type");
  if (contentType) {
    headers["Content-Type"] = contentType as string;
  }

  if (!shouldEnd) {
    delete headers["Content-Length"];
  }

  res.writeHead(200, headers);

  if (req.method === "HEAD") {
    if (shouldEnd) {
      res.end();
    }
    void Promise.resolve(onSent?.(req, res, file)).catch((error) => {
      console.error("[nlite] Failed to finish static response", error);
      if (!res.writableEnded) {
        res.end();
      }
    });
    return;
  }

  const stream = createReadStream(file.abs);
  stream.on("error", () => {
    if (!res.headersSent) {
      res.statusCode = 500;
    }
    if (shouldEnd && !res.writableEnded) {
      res.end();
    }
  });
  stream.on("end", () => {
    void Promise.resolve(onSent?.(req, res, file)).catch((error) => {
      console.error("[nlite] Failed to finish static response", error);
      if (!res.writableEnded) {
        res.end();
      }
    });
  });
  stream.pipe(res, { end: shouldEnd });
}

function toHeaders(name: string, stats: Stats, isEtag: boolean) {
  const headers: Record<string, string | number> = {
    "Content-Length": stats.size,
    "Content-Type": lookupMime(name),
    "Last-Modified": stats.mtime.toUTCString(),
  };

  if (isEtag) {
    headers.ETag = `W/"${stats.size}-${stats.mtime.getTime()}"`;
    headers["Cache-Control"] = "no-cache";
  }

  return headers;
}

function lookupMime(name: string) {
  const extension = path.extname(name).slice(1).toLowerCase();
  return MIME_TYPES[extension] || "application/octet-stream";
}

function resolveInside(root: string, uri: string) {
  const relativePath = uri.replace(/^\/+/, "");
  const resolved = path.resolve(root, relativePath);
  const relative = path.relative(root, resolved);

  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    return;
  }

  return resolved;
}

function getPathname(rawUrl: string | undefined) {
  if (!rawUrl) {
    return;
  }

  const pathname = rawUrl.split("?")[0];

  try {
    return decodeURIComponent(pathname);
  } catch {
    return pathname;
  }
}
