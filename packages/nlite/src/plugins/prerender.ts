import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { ConfigEnv, Plugin, ResolvedConfig, UserConfig } from "vite";

import { NOT_FOUND_HTML_FILE, NOT_FOUND_RSC_FILE, resolveStaleTimes } from "../utils/constants.js";
import { createPreviewHeadersMiddleware, writeAssetHeaders } from "../utils/headers.js";
import type { NliteOptions, PrerenderPath } from "../types.js";
import { normalizeHtmlFilePath, normalizeRoutePath, normalizeRscFilePath } from "../utils/path.js";
import { createWorker, type WorkerProxy } from "../lib/worker/index.js";
import type { PrerenderWorker } from "../internal/prerender-worker.js";

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

      server.middlewares.use(createPreviewHeadersMiddleware(distDir));
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
  const worker = createPrerenderWorker();

  try {
    for (const { path: routePath, forcePrerender } of staticPaths) {
      const result = await worker.renderRoute({
        entryPath,
        routePath,
        forcePrerender,
      });

      if (result.skip) continue;

      await Promise.all([
        writeBytesToFile(path.join(outDir, normalizeHtmlFilePath(routePath)), result.stream),
        writeBytesToFile(path.join(outDir, normalizeRscFilePath(routePath)), result.rsc),
      ]);
    }

    // write global _not-found
    const notFoundResult = await worker.renderNotFound({ entryPath });
    if (!notFoundResult.skip) {
      await Promise.all([
        writeBytesToFile(path.join(outDir, NOT_FOUND_HTML_FILE), notFoundResult.stream),
        writeBytesToFile(path.join(outDir, NOT_FOUND_RSC_FILE), notFoundResult.rsc),
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

async function writeBytesToFile(filePath: string, bytes: number[]) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, Uint8Array.from(bytes));
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
