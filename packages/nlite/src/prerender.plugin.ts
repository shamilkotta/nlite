import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { Readable } from "node:stream";
import { pathToFileURL } from "node:url";
import type { ConfigEnv, Plugin, ResolvedConfig, UserConfig } from "vite";
import type { PrerenderPath } from "./types.js";
import { normalizeHtmlFilePath, normalizeRoutePath, normalizeRscFilePath } from "./utils/path.js";

export function prerender(): Plugin {
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

      // rewrite clean URLs to prerendered html files
      server.middlewares.use((req, _res, next) => {
        if (req.method !== "GET" && req.method !== "HEAD") {
          return next();
        }

        const accept = req.headers.accept;
        if (
          accept !== undefined &&
          accept !== "" &&
          !accept.includes("text/html") &&
          !accept.includes("*/*")
        ) {
          return next();
        }

        const rawUrl = req.url;
        if (!rawUrl) {
          return next();
        }

        const [pathnamePart, ...rest] = rawUrl.split("?");
        const query = rest.length > 0 ? `?${rest.join("?")}` : "";

        let pathname: string;
        try {
          pathname = decodeURIComponent(pathnamePart);
        } catch {
          return next();
        }

        if (path.extname(pathname) || pathname == "/" || pathname == "") {
          return next();
        }

        let htmlRelative: string;
        if (pathname.endsWith("/")) {
          htmlRelative = pathname.slice(1) + "index.html";
        } else {
          htmlRelative = normalizeHtmlFilePath(pathname);
        }

        if (existsSync(path.join(distDir, htmlRelative))) {
          req.url = `/${htmlRelative}${query}`;
        }

        next();
      });
    },
    buildApp: {
      async handler(builder) {
        await renderStatic(builder.config);
      },
    },
  };
}

async function renderStatic(config: ResolvedConfig) {
  const entryPath = path.join(config.environments.rsc.build.outDir, "index.js");
  const entry: typeof import("./modules/entry.rsc.js") = await import(
    /* @vite-ignore */ pathToFileURL(entryPath).href
  );

  if (!entry.collectPrerenderPaths || !entry.handlePrerender) {
    return;
  }

  const staticPaths = normalizePaths(await entry.collectPrerenderPaths());
  const outDir = path.resolve(config.environments.client.build.outDir);

  for (const { path: routePath, forcePrerender } of staticPaths) {
    const request = new Request(new URL(routePath, "http://nlite.local"));
    const shouldPrerender = forcePrerender || (await probePrerenderRoute(entryPath, routePath));
    if (!shouldPrerender) continue;

    const { rsc, stream, skip } = await entry.handlePrerender(request);
    if (skip) continue;

    await Promise.all([
      writeStreamToFile(path.join(outDir, normalizeHtmlFilePath(routePath)), stream!),
      writeStreamToFile(path.join(outDir, normalizeRscFilePath(routePath)), rsc!),
    ]);
  }
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
  await writeFile(filePath, Readable.fromWeb(stream as any));
}

async function probePrerenderRoute(entryPath: string, routePath: string) {
  const entryUrl = pathToFileURL(entryPath).href;
  const routeUrl = new URL(routePath, "http://nlite.local").href;
  const script = `
    const entry = await import(${JSON.stringify(entryUrl)});
    const result = await entry.probePrerender(new Request(${JSON.stringify(routeUrl)}));
    if (process.send) process.send({ type: "result", result });
    process.exit(result ? 0 : 2);
  `;

  return new Promise<boolean>((resolve, reject) => {
    const child = spawn(process.execPath, ["--input-type=module", "--eval", script], {
      stdio: ["ignore", "ignore", "inherit", "ipc"],
      env: process.env,
    });
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      resolve(false);
    }, 30_000);
    let settled = false;

    child.on("message", (message) => {
      if (
        message &&
        typeof message === "object" &&
        "type" in message &&
        message.type === "result" &&
        "result" in message
      ) {
        settled = true;
        clearTimeout(timeout);
        resolve(Boolean(message.result));
      }
    });

    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    child.on("exit", (code, signal) => {
      clearTimeout(timeout);

      if (settled) {
        return;
      }

      if (signal) {
        resolve(false);
        return;
      }

      if (code === 0 || code === 2) {
        resolve(code === 0);
        return;
      }

      reject(new Error(`Prerender probe failed for "${routePath}" with exit code ${code}`));
    });
  });
}
