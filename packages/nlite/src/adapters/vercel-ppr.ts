import { promises as fs } from "node:fs";
import path from "node:path";

import {
  HTML_CONTENT_TYPE,
  META_POSTFIX,
  NEXT_RESUME_HEADER,
  PRE_RENDER_CONTENT_TYPE,
} from "../utils/constants.js";
import { normalizeHtmlFilePath, normalizeRoutePath } from "../utils/path.js";

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
  stateLength: number;
}

/**
 * Builds the content-type Vercel's CDN uses to split postponed state from the
 * HTML/RSC shell. `state-length` is a UTF-8 byte offset (not string length).
 */
export function getPostponedStateContentType(
  postponedState: string,
  originContentType: string = HTML_CONTENT_TYPE,
): string {
  return `${PRE_RENDER_CONTENT_TYPE}; state-length=${Buffer.byteLength(
    postponedState,
  )}; origin=${JSON.stringify(originContentType)}`;
}

/** Map a route path to the Vercel functions pathname (`/` → `index`). */
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

/**
 * Scan the client/static output for `.meta` files marked PARTIALLY_STATIC and
 * load the matching HTML shell + meta JSON (used as the opaque resume body).
 */
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

/**
 * Emit a Vercel Build Output API v3 PPR prerender matching adapter-vercel:
 * - fallback body = postponedState (meta JSON) + HTML shell
 * - content-type = application/x-nextjs-pre-render; state-length=…; origin=…
 * - chain.headers.next-resume = 1 so the CDN POSTs the state prefix to the function
 */
export async function writePprPrerender(options: {
  functionsDir: string;
  parentFunctionName: string;
  route: PartiallyStaticRoute;
  groupId: number;
  expiration?: number | false;
}): Promise<WrittenPprPrerender> {
  const { functionsDir, parentFunctionName, route, groupId, expiration = false } = options;

  const prerenderPath = toVercelPrerenderPath(route.routePath);
  const postponedState = route.metaText;
  const stateLength = Buffer.byteLength(postponedState);

  const fallbackFileName = `${path.basename(prerenderPath)}.prerender-fallback.html`;
  const configFileName = `${path.basename(prerenderPath)}.prerender-config.json`;

  // Nested routes live in subdirectories: blog/post → functions/blog/post.*
  const outputDir = path.join(functionsDir, path.dirname(prerenderPath));
  await fs.mkdir(outputDir, { recursive: true });

  const fallbackPath = path.join(outputDir, fallbackFileName);
  const configPath = path.join(outputDir, configFileName);
  const functionDir = path.join(functionsDir, `${prerenderPath}.func`);
  const parentFunctionDir = path.join(functionsDir, `${parentFunctionName}.func`);

  await fs.writeFile(fallbackPath, `${postponedState}${route.htmlText}`);

  const config = {
    expiration,
    group: groupId,
    passQuery: true,
    allowQuery: [] as string[],
    initialStatus: 200,
    initialHeaders: {
      "content-type": getPostponedStateContentType(postponedState, HTML_CONTENT_TYPE),
    },
    fallback: fallbackFileName,
    chain: {
      headers: {
        [NEXT_RESUME_HEADER]: "1",
      },
      // Keep the `./` prefix — matches adapter-vercel / Vercel CDN expectations.
      outputPath: `./${prerenderPath}`,
    },
  };

  await fs.writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);

  // Share the catch-all function code (same as adapter-vercel).
  if (path.resolve(functionDir) !== path.resolve(parentFunctionDir)) {
    await fs.mkdir(path.dirname(functionDir), { recursive: true });
    await fs.rm(functionDir, { recursive: true, force: true });
    await fs.symlink(path.relative(path.dirname(functionDir), parentFunctionDir), functionDir);
  }

  return {
    routePath: route.routePath,
    prerenderPath,
    configPath,
    fallbackPath,
    stateLength,
  };
}

/** Remove PPR shells from static so CDN serves the prerender primitive instead. */
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
