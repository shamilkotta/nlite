import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import { pathToFileURL } from "node:url";
import type { ConfigEnv, Plugin, ResolvedConfig, UserConfig } from "vite";

import { PRERENDER_ORIGIN, NOT_FOUND_HTML, resolveStaleTimes } from "../utils/constants.js";
import { writeAssetHeaders } from "../utils/headers.js";
import type { NliteOptions, PrerenderPath } from "../types.js";
import { normalizeHtmlFilePath, normalizeRoutePath, normalizeRscFilePath } from "../utils/path.js";

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
    configurePreviewServer(server) {
      const distDir = path.resolve(
        server.config.root,
        server.config.environments.client.build.outDir,
      );

      server.middlewares.use((req, _res, next) => {
        const htmlPath = getPreviewHtmlRewrite(req, distDir);

        if (htmlPath) {
          req.url = htmlPath;
        }

        next();
      });
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

  if (
    pathname.startsWith("/api/") ||
    Boolean(path.extname(pathname)) ||
    pathname.split("/").pop()?.includes(".")
  )
    return;

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

  if (!entry.collectPrerenderPaths || !entry.handlePrerender) {
    return;
  }

  const staticPaths = normalizePaths(await entry.collectPrerenderPaths());
  const outDir = path.resolve(config.environments.client.build.outDir);

  for (const { path: routePath, forcePrerender } of staticPaths) {
    const request = new Request(new URL(routePath, PRERENDER_ORIGIN));

    const { rsc, stream, skip } = await entry.handlePrerender(request, { forcePrerender });
    if (skip || !stream || !rsc) continue;

    await Promise.all([
      writeStreamToFile(path.join(outDir, normalizeHtmlFilePath(routePath)), stream),
      writeStreamToFile(path.join(outDir, normalizeRscFilePath(routePath)), rsc),
    ]);
  }

  const notFoundHtml = path.join(outDir, "404.html");
  if (!existsSync(notFoundHtml)) {
    await writeFile(notFoundHtml, NOT_FOUND_HTML);
  }

  await writeAssetHeaders(outDir, resolveStaleTimes(options.staleTimes).static);
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

async function writeStreamToFile(filePath: string, stream: ReadableStream<Uint8Array>) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, Readable.fromWeb(stream as NodeReadableStream<Uint8Array>));
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
