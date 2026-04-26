import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pathToFileURL } from "node:url";
import type { ConfigEnv, Plugin, ResolvedConfig, UserConfig } from "vite";

const RSC_POSTFIX = ".rsc";

export function prerender(): Plugin {
  return {
    name: "nlite:prerender",
    config: {
      order: "pre",
      handler(_config: UserConfig, env: ConfigEnv) {
        return {
          appType: env.isPreview ? "mpa" : undefined,
          rsc: {
            serverHandler: env.isPreview ? false : undefined,
          },
        };
      },
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

  if (!entry.collectPrerenderPaths || !entry.handleSsg) {
    return;
  }

  const staticPaths = normalizePaths(await entry.collectPrerenderPaths());
  const outDir = path.resolve(config.environments.client.build.outDir);

  for (const routePath of staticPaths) {
    const request = new Request(new URL(routePath, "http://nlite.local"));
    const { stream: html, rsc } = await entry.handleSsg(request);

    await writeStreamToFile(path.join(outDir, normalizeHtmlFilePath(routePath)), html);
    await writeStreamToFile(path.join(outDir, normalizeRscFilePath(routePath)), rsc);
  }
}

function normalizePaths(paths: string[]) {
  return [...new Set(paths)]
    .map((routePath) => normalizeRoutePath(routePath))
    .sort((left, right) => left.localeCompare(right));
}

function normalizeRoutePath(routePath: string) {
  if (!routePath || routePath === "/") {
    return "/";
  }

  const withLeadingSlash = routePath.startsWith("/") ? routePath : `/${routePath}`;
  return withLeadingSlash.endsWith("/") ? withLeadingSlash.slice(0, -1) : withLeadingSlash;
}

function normalizeHtmlFilePath(routePath: string) {
  if (routePath === "/") {
    return "index.html";
  }

  return routePath.slice(1) + ".html";
}

function normalizeRscFilePath(routePath: string) {
  if (routePath === "/") {
    return "index" + RSC_POSTFIX;
  }

  return routePath.slice(1) + RSC_POSTFIX;
}

async function writeStreamToFile(filePath: string, stream: ReadableStream<Uint8Array>) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, Readable.fromWeb(stream as any));
}
