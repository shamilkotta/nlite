import { promises as fs } from "node:fs";
import path from "node:path";

import { META_POSTFIX, STALE_TIME_HEADER } from "../../utils/constants.js";
import { normalizeHtmlFilePath, normalizeRoutePath } from "../../utils/path.js";
import {
  HTML_CONTENT_TYPE,
  NEXT_RESUME_HEADER,
  PPR_EXPIRATION,
  PRE_RENDER_CONTENT_TYPE,
  RSC_CONTENT_TYPE,
} from "./constants.js";

export interface PartiallyStaticRoute {
  routePath: string;
  metaRelativePath: string;
  htmlRelativePath: string;
  metaText: string;
  htmlText: string;
}

export interface WrittenPprPrerender {
  routePath: string;
  prerenderPath: string;
  configPath: string;
  fallbackPath: string;
  rscConfigPath: string;
  rscFallbackPath: string;
  stateLength: number;
}

export function getPostponedStateContentType(
  postponedState: string,
  originContentType: string = HTML_CONTENT_TYPE,
): string {
  return `${PRE_RENDER_CONTENT_TYPE}; state-length=${Buffer.byteLength(
    postponedState,
  )}; origin=${JSON.stringify(originContentType)}`;
}

export function chainOutputPath(routePath: string, rsc: boolean): string {
  if (routePath === "/") {
    return rsc ? ".rsc" : "index";
  }

  const prerenderPath = toVercelPrerenderPath(routePath);
  return rsc ? `${prerenderPath}.rsc` : prerenderPath;
}

export function toVercelPrerenderPath(routePath: string): string {
  const normalized = normalizeRoutePath(routePath);
  if (normalized === "/") {
    return "index";
  }
  return normalized.slice(1);
}

export function routePathFromMetaRelative(metaRelativePath: string): string {
  const withoutMeta = metaRelativePath.replace(/\.meta$/i, "");
  if (withoutMeta === "index" || withoutMeta === "") {
    return "/";
  }
  return normalizeRoutePath(`/${withoutMeta}`);
}

export async function collectPartiallyStaticRoutes(
  staticDir: string,
): Promise<PartiallyStaticRoute[]> {
  const metaFiles = await walkFiles(staticDir, (name) => name.endsWith(META_POSTFIX));
  const routes: PartiallyStaticRoute[] = [];

  for (const metaAbsolute of metaFiles) {
    const metaRelativePath = path.relative(staticDir, metaAbsolute).split(path.sep).join("/");
    const metaText = await fs.readFile(metaAbsolute, "utf8");

    let meta: { renderingMode?: string };
    try {
      meta = JSON.parse(metaText) as { renderingMode?: string };
    } catch {
      continue;
    }

    if (meta.renderingMode !== "PARTIALLY_STATIC") {
      continue;
    }

    const routePath = routePathFromMetaRelative(metaRelativePath);
    const htmlRelativePath = normalizeHtmlFilePath(routePath);
    const htmlAbsolute = path.join(staticDir, htmlRelativePath);

    if (!(await fileExists(htmlAbsolute))) {
      continue;
    }

    routes.push({
      routePath,
      metaRelativePath,
      htmlRelativePath,
      metaText,
      htmlText: await fs.readFile(htmlAbsolute, "utf8"),
    });
  }

  return routes.sort((a, b) => a.routePath.localeCompare(b.routePath));
}

export async function writePprPrerender(options: {
  functionsDir: string;
  parentFunctionName: string;
  route: PartiallyStaticRoute;
  groupId: number;
  expiration?: number | false;
  staleExpiration?: number;
  staleTime?: number;
}): Promise<WrittenPprPrerender> {
  const {
    functionsDir,
    parentFunctionName,
    route,
    groupId,
    expiration = PPR_EXPIRATION,
    staleExpiration,
    staleTime = 0,
  } = options;

  const prerenderPath = toVercelPrerenderPath(route.routePath);
  const postponedState = route.metaText;
  const stateLength = Buffer.byteLength(postponedState);
  const baseName = path.basename(chainOutputPath(route.routePath, false));
  const rscBaseName = path.basename(chainOutputPath(route.routePath, true));

  const fallbackFileName = `${baseName}.prerender-fallback.html`;
  const configFileName = `${baseName}.prerender-config.json`;
  const rscFallbackFileName = `${rscBaseName}.prerender-fallback.rsc`;
  const rscConfigFileName = `${rscBaseName}.prerender-config.json`;

  const outputDir = path.join(functionsDir, path.dirname(prerenderPath));
  await fs.mkdir(outputDir, { recursive: true });

  const fallbackPath = path.join(outputDir, fallbackFileName);
  const configPath = path.join(outputDir, configFileName);
  const rscFallbackPath = path.join(outputDir, rscFallbackFileName);
  const rscConfigPath = path.join(outputDir, rscConfigFileName);
  const parentFunctionDir = path.join(functionsDir, `${parentFunctionName}.func`);

  await Promise.all([
    fs.writeFile(fallbackPath, `${postponedState}${route.htmlText}`),
    fs.writeFile(rscFallbackPath, postponedState),
  ]);

  const shared = {
    group: groupId,
    exposeErrBody: true,
    expiration,
    ...(staleExpiration !== undefined ? { staleExpiration } : {}),
    sourcePath: route.routePath,
    passQuery: true,
    allowQuery: [] as string[],
  };

  const config = {
    ...shared,
    initialMetadata: {
      compute: "resuming",
      htmlSize: Buffer.byteLength(route.htmlText),
    },
    initialStatus: 200,
    initialHeaders: {
      "content-type": getPostponedStateContentType(postponedState, HTML_CONTENT_TYPE),
    },
    fallback: fallbackFileName,
    chain: {
      headers: {
        [NEXT_RESUME_HEADER]: "1",
      },
      outputPath: chainOutputPath(route.routePath, false),
    },
  };

  const rscConfig = {
    ...shared,
    initialHeaders: {
      "content-type": getPostponedStateContentType(postponedState, RSC_CONTENT_TYPE),
      "cache-control": "private, no-store, no-cache, max-age=0, must-revalidate",
      [STALE_TIME_HEADER]: String(staleTime),
    },
    fallback: rscFallbackFileName,
    chain: {
      headers: {
        [NEXT_RESUME_HEADER]: "1",
      },
      outputPath: chainOutputPath(route.routePath, true),
    },
  };

  await Promise.all([
    fs.writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`),
    fs.writeFile(rscConfigPath, `${JSON.stringify(rscConfig, null, 2)}\n`),
    linkFunction(path.join(functionsDir, `${prerenderPath}.func`), parentFunctionDir),
    linkFunction(
      path.join(functionsDir, `${chainOutputPath(route.routePath, true)}.func`),
      parentFunctionDir,
    ),
  ]);

  return {
    routePath: route.routePath,
    prerenderPath,
    configPath,
    fallbackPath,
    rscConfigPath,
    rscFallbackPath,
    stateLength,
  };
}

async function linkFunction(functionDir: string, parentFunctionDir: string) {
  if (path.resolve(functionDir) === path.resolve(parentFunctionDir)) {
    return;
  }

  await fs.mkdir(path.dirname(functionDir), { recursive: true });
  await fs.rm(functionDir, { recursive: true, force: true });
  await fs.symlink(path.relative(path.dirname(functionDir), parentFunctionDir), functionDir);
}

export async function removeStaticPprArtifacts(
  staticDir: string,
  route: PartiallyStaticRoute,
): Promise<void> {
  await Promise.all([
    fs.rm(path.join(staticDir, route.htmlRelativePath), { force: true }),
    fs.rm(path.join(staticDir, route.metaRelativePath), { force: true }),
  ]);
}

async function walkFiles(dir: string, filter: (name: string) => boolean): Promise<string[]> {
  const results: string[] = [];

  async function walk(current: string) {
    let entries;
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile() && filter(entry.name)) {
        results.push(fullPath);
      }
    }
  }

  await walk(dir);
  return results;
}

async function fileExists(filePath: string) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
