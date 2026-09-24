import { existsSync } from "node:fs";
import type { ServerResponse } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { ConfigEnv, Connect, Plugin, ResolvedConfig, UserConfig } from "vite";

import {
  META_POSTFIX,
  NOT_FOUND_HTML_FILE,
  NOT_FOUND_RSC_FILE,
  RESUME_HEADER,
  resolveStaleTimes,
} from "../utils/constants.js";
import { createPreviewHeadersMiddleware, writeAssetHeaders } from "../utils/headers.js";
import type { NliteOptions, PrerenderPath } from "../types.js";
import {
  normalizeHtmlFilePath,
  normalizeMetaFilePath,
  normalizeRoutePath,
  normalizeRscFilePath,
} from "../utils/path.js";
import { sirv } from "../lib/sirv.js";
import { createWorker, type WorkerProxy } from "../lib/worker/index.js";
import type { PrerenderWorker } from "../internal/prerender-worker.js";
import { tryCatch } from "../utils/index.js";

export function prerender(options: NliteOptions = {}): Plugin {
  return {
    name: "nlite:prerender",
    config: {
      order: "pre",
      handler(_config: UserConfig, env: ConfigEnv) {
        return {
          appType: env.isPreview ? "mpa" : undefined,
          rsc: {
            serverHandler: undefined,
          },
        };
      },
    },
    async configurePreviewServer(server) {
      const distDir = path.resolve(server.config.environments.client.build.outDir);

      server.middlewares.use(createPreviewHeadersMiddleware(distDir));
      server.middlewares.use((req, _res, next) => {
        const htmlPath = getPreviewHtmlRewrite(req, distDir);

        if (htmlPath) {
          req.originalUrl ??= req.url;
          req.url = htmlPath;
        }

        next();
      });

      if (!options.ppr) {
        return;
      }

      server.middlewares.use((req, _res, next) => {
        delete req.headers["accept-encoding"];
        next();
      });

      const entryPath = path.join(server.config.environments.rsc.build.outDir, "index.js");
      const rscEntry: typeof import("../modules/entry.rsc.js") = await import(
        /* @vite-ignore */ pathToFileURL(entryPath).href
      );

      server.middlewares.use(createPprResumeMiddleware(distDir, rscEntry.handler));
    },
    buildApp: {
      async handler(builder) {
        await renderStatic(builder.config, options);
      },
    },
  };
}

function getPreviewHtmlRewrite(
  req: { method?: string; headers: { accept?: string | string[] }; url?: string },
  distDir: string,
) {
  if (req.method !== "GET" && req.method !== "HEAD") return;
  const accept = Array.isArray(req.headers.accept)
    ? req.headers.accept.join(",")
    : req.headers.accept;

  const isHtmlAccept = !accept || accept.includes("text/html") || accept.includes("*/*");

  if (!isHtmlAccept) return;

  const parsedUrl = parseRequestUrl(req.url);
  if (!parsedUrl) {
    return;
  }

  const { pathname, query } = parsedUrl;

  if (Boolean(path.extname(pathname)) || pathname.split("/").pop()?.includes(".")) return;

  const htmlRelative = normalizeHtmlFilePath(normalizeRoutePath(pathname));
  if (!existsSync(path.join(distDir, htmlRelative))) {
    return;
  }

  return `/${htmlRelative}${query}`;
}

async function renderStatic(config: ResolvedConfig, options: NliteOptions) {
  const entryPath = path.join(config.environments.rsc.build.outDir, "index.js");
  const entry: typeof import("../modules/entry.rsc.js") = await import(
    /* @vite-ignore */ pathToFileURL(entryPath).href
  );

  const staticPaths = normalizePaths(await entry.collectPrerenderPaths());

  const outDir = path.resolve(config.environments.client.build.outDir);
  const worker = createPrerenderWorker();

  try {
    for (const { path: routePath, forcePrerender } of staticPaths) {
      const result = await worker.renderRoute({
        ppr: options.ppr,
        entryPath,
        routePath,
        forcePrerender,
      });

      if (result.skip) continue;

      await Promise.all([
        writeToFile(path.join(outDir, normalizeHtmlFilePath(routePath)), result.stream),
        !result.postponed
          ? writeToFile(path.join(outDir, normalizeRscFilePath(routePath)), result.rsc)
          : null,
        writeToFile(
          path.join(outDir, normalizeMetaFilePath(routePath)),
          JSON.stringify({
            postponed: result.postponed ?? undefined,
            cache: options.ppr ? result.cache : undefined,
            renderingMode: result.postponed ? "PARTIALLY_STATIC" : "STATIC",
          }),
        ),
      ]);
    }

    // TODO: revisit here
    const notFoundResult = await worker.renderNotFound({ entryPath });

    if (!notFoundResult.skip) {
      await Promise.all([
        writeToFile(path.join(outDir, NOT_FOUND_HTML_FILE), notFoundResult.stream),
        writeToFile(path.join(outDir, NOT_FOUND_RSC_FILE), notFoundResult.rsc),
      ]);
    }
  } finally {
    worker.end();
  }

  await writeAssetHeaders(outDir, resolveStaleTimes(options.staleTimes));
}

function normalizePaths(paths: PrerenderPath[]) {
  const byPath = new Map<string, PrerenderPath>();

  for (const prerenderPath of paths) {
    const normalizedPath = normalizeRoutePath(prerenderPath.path);
    const previous = byPath.get(normalizedPath);

    byPath.set(normalizedPath, {
      path: normalizedPath,
      forcePrerender: Boolean(previous?.forcePrerender || prerenderPath.forcePrerender),
    });
  }

  return [...byPath.values()].sort((left, right) => left.path.localeCompare(right.path));
}

async function writeToFile(
  filePath: string,
  data: Uint8Array | number[] | string | ReadableStream<Uint8Array>,
) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const payload = Array.isArray(data) ? Uint8Array.from(data) : data;
  await writeFile(filePath, payload);
}

function parseRequestUrl(rawUrl: string | undefined) {
  if (!rawUrl) {
    return;
  }

  const [pathnamePart, ...rest] = rawUrl.split("?");
  const query = rest.length > 0 ? `?${rest.join("?")}` : "";

  try {
    return {
      pathname: decodeURIComponent(pathnamePart),
      query,
    };
  } catch {
    return;
  }
}

function createPprResumeMiddleware(
  distDir: string,
  handler: (request: Request) => Promise<Response>,
) {
  return async (req: Connect.IncomingMessage, res: ServerResponse, next: () => void) => {
    if (
      (req.method !== "GET" && req.method !== "HEAD") ||
      (!req.url?.endsWith(".rsc") && !req.url?.endsWith(".html"))
    ) {
      return next();
    }

    const meta = await resolveRouteMeta(distDir, req.url);
    if (!meta?.trim() || JSON.parse(meta).renderingMode !== "PARTIALLY_STATIC") {
      return next();
    }

    if (req.url?.endsWith(".html")) {
      const pendingResumes = new WeakMap<ServerResponse, Promise<Response>>();
      return sirv(distDir, {
        etag: true,
        extensions: ["html"],
        end: (req) => req.method !== "GET",
        onFile(req, res) {
          pendingResumes.set(res, createResumeRequest(req, meta).then(handler));
        },
        async onSent(req, res) {
          if (res.writableEnded) return;

          const response = pendingResumes.get(res) ?? createResumeRequest(req, meta).then(handler);
          const [resumeResponse, error] = await tryCatch(response);

          pendingResumes.delete(res);
          if (error) {
            console.error("[nlite] PPR resume failed", error);
            if (!res.writableEnded) {
              res.end();
            }
            return;
          }
          if (resumeResponse.body) {
            await writeReadableStreamToNode(resumeResponse.body, res);
          }
          if (!res.writableEnded) {
            res.end();
          }
        },
      })(req, res, next);
    }

    try {
      const resumeResponse = await handler(await createResumeRequest(req, meta));
      res.statusCode = resumeResponse.status;
      resumeResponse.headers.forEach((value, name) => {
        if (!HOP_BY_HOP_HEADERS.has(name.toLowerCase())) {
          res.setHeader(name, value);
        }
      });

      if (req.method === "HEAD" || !resumeResponse.body) {
        res.end();
        return;
      }

      await writeReadableStreamToNode(resumeResponse.body, res);
      if (!res.writableEnded) {
        res.end();
      }
    } catch (error) {
      console.error("[nlite] PPR RSC resume failed", error);
      if (!res.headersSent) {
        res.statusCode = 500;
      }
      if (!res.writableEnded) {
        res.end();
      }
    }
  };
}

async function createResumeRequest(req: Connect.IncomingMessage, meta: string) {
  const host = typeof req.headers.host === "string" ? req.headers.host : "127.0.0.1";
  const url = new URL(req.originalUrl ?? req.url ?? "/", `http://${host}`);

  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (!value || HOP_BY_HOP_HEADERS.has(name.toLowerCase())) {
      continue;
    }

    headers.set(name, Array.isArray(value) ? value.join(", ") : value);
  }

  headers.set(RESUME_HEADER, "1");
  return new Request(url, {
    method: "POST",
    headers,
    body: meta,
  });
}

function resolveRouteMeta(distDir: string, rawUrl: string) {
  const parsedUrl = parseRequestUrl(rawUrl);
  if (!parsedUrl) return;
  let metaPath;
  if (parsedUrl.pathname.endsWith(".html")) {
    metaPath = path.join(distDir, parsedUrl.pathname.replace(".html", META_POSTFIX));
  } else if (parsedUrl.pathname.endsWith(".rsc")) {
    const routePath = normalizeRoutePath(parsedUrl.pathname.slice(0, -".rsc".length) || "/");
    metaPath = path.join(distDir, normalizeMetaFilePath(routePath));
  } else {
    return;
  }

  if (!existsSync(metaPath)) {
    return;
  }
  return readFile(metaPath, "utf8");
}

async function writeReadableStreamToNode(stream: ReadableStream<Uint8Array>, res: ServerResponse) {
  const reader = stream.getReader();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      if (!res.write(value)) {
        await new Promise<void>((resolve, reject) => {
          const onDrain = () => {
            res.off("error", onError);
            resolve();
          };
          const onError = (error: Error) => {
            res.off("drain", onDrain);
            reject(error);
          };
          res.once("drain", onDrain);
          res.once("error", onError);
        });
      }
    }
  } finally {
    reader.releaseLock();
  }
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

function createPrerenderWorker(): WorkerProxy<PrerenderWorker> {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  return createWorker<PrerenderWorker>(path.join(currentDir, "internal", "prerender-worker.mjs"), {
    exposedMethods: ["renderRoute", "renderNotFound"],
    onChildMessage(message, { resolve }) {
      if (message && (message as { type?: string }).type === "dynamicUsage") {
        resolve({ skip: true });
        return true;
      }

      return false;
    },
  });
}
