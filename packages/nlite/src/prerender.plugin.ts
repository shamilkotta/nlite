import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pathToFileURL } from "node:url";
import type { ConfigEnv, Plugin, UserConfig } from "vite";
import { PPR_MANIFEST_FILE } from "./utils/constants.js";
import {
  normalizeHtmlFilePath,
  normalizePostponedFilePath,
  normalizeRscFilePath,
  normalizeRoutePath,
} from "./utils/path.js";

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
    buildApp: {
      order: "post",
      async handler(builder) {
        await renderStaticOutput({
          rscOutDir: builder.config.environments.rsc.build.outDir,
          clientOutDir: builder.config.environments.client.build.outDir,
        });
      },
    },
  };
}

export async function renderStaticOutput(options: { rscOutDir: string; clientOutDir: string }) {
  const entryPath = path.join(options.rscOutDir, "index.js");
  const entry: typeof import("./modules/entry.rsc.js") = await import(
    /* @vite-ignore */ pathToFileURL(entryPath).href
  );

  const paths = normalizePaths(await entry.collectPaths());
  const outDir = path.resolve(options.clientOutDir);
  const manifest: PprManifestEntry[] = [];

  for (const routePath of paths) {
    const request = new Request(new URL(routePath, "http://nlite.local"));
    const { stream: html, rsc, postponed } = await entry.handlePrerender(request);
    const htmlPath = normalizeHtmlFilePath(routePath);
    const rscPath = normalizeRscFilePath(routePath);
    const postponedPath = normalizePostponedFilePath(routePath);

    const writeFiles = [];
    if (html) {
      writeFiles.push(writeStreamToFile(path.join(outDir, htmlPath), html));
    }
    if (rsc) {
      writeFiles.push(writeStreamToFile(path.join(outDir, rscPath), rsc));
    }
    if (postponed) {
      writeFiles.push(writeJsonToFile(path.join(outDir, postponedPath), postponed));
    }

    await Promise.all(writeFiles);

    manifest.push({
      routePath,
      html: htmlPath,
      postponed: postponedPath,
      mode: postponed ? "PARTIAL_PRE_RENDER" : "PRE_RENDER",
    });
  }

  await writeJsonToFile(path.join(outDir, PPR_MANIFEST_FILE), manifest);
}

interface PprManifestEntry {
  routePath: string;
  html: string;
  postponed: string | null;
  mode: "PRE_RENDER" | "PARTIAL_PRE_RENDER";
}

function normalizePaths(paths: string[]) {
  return [...new Set(paths)]
    .map((routePath) => normalizeRoutePath(routePath))
    .sort((left, right) => left.localeCompare(right));
}

async function writeStreamToFile(filePath: string, stream: ReadableStream<Uint8Array>) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, Readable.fromWeb(stream as any));
}

async function writeJsonToFile(filePath: string, value: unknown) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(value, null, 2));
}
