import { access } from "node:fs/promises";
import path from "node:path";

import { glob } from "tinyglobby";

const DEFAULT_EXTENSIONS = ["tsx", "ts", "jsx", "js"];

export interface RouteModuleFiles {
  page: string;
  layouts: string[];
  loading?: string;
  error?: string;
}

export interface DiscoveredRoute extends RouteModuleFiles {
  id: string;
  routePath: string;
}

export async function discoverRoutes(
  projectRoot: string,
  appDir = "app",
  extensions = DEFAULT_EXTENSIONS,
) {
  const appRoot = path.resolve(projectRoot, appDir);
  const pagePattern = `**/page.{${extensions.join(",")}}`;
  const pageFiles = await glob(pagePattern, {
    cwd: appRoot,
    absolute: true,
    onlyFiles: true,
  });

  const routes: DiscoveredRoute[] = [];

  for (const pageFile of pageFiles.sort()) {
    const pageDir = path.dirname(pageFile);
    const layouts = await collectLayouts(appRoot, pageDir, extensions);

    routes.push({
      id: toPosix(path.relative(projectRoot, pageFile)),
      routePath: toRoutePath(appRoot, pageFile),
      page: pageFile,
      layouts,
      loading: await findConventionFile(pageDir, "loading", extensions),
      error: await findConventionFile(pageDir, "error", extensions),
    });
  }

  return routes.sort((left, right) => scoreRoute(right.routePath) - scoreRoute(left.routePath));
}

async function collectLayouts(appRoot: string, pageDir: string, extensions: string[]) {
  const layouts: string[] = [];
  let currentDir = pageDir;

  while (currentDir.startsWith(appRoot)) {
    const layoutFile = await findConventionFile(currentDir, "layout", extensions);

    if (layoutFile) {
      layouts.unshift(layoutFile);
    }

    if (currentDir === appRoot) {
      break;
    }

    currentDir = path.dirname(currentDir);
  }

  return layouts;
}

async function findConventionFile(dir: string, basename: string, extensions: string[]) {
  for (const extension of extensions) {
    const candidate = path.join(dir, `${basename}.${extension}`);

    try {
      await access(candidate);
      return candidate;
    } catch {
      continue;
    }
  }

  return undefined;
}

function toRoutePath(appRoot: string, pageFile: string) {
  const relativeDir = path.relative(appRoot, path.dirname(pageFile));

  if (!relativeDir) {
    return "/";
  }

  const segments = relativeDir
    .split(path.sep)
    .filter(Boolean)
    .filter((segment) => !(segment.startsWith("(") && segment.endsWith(")")))
    .map((segment) => {
      if (segment.startsWith("[...") && segment.endsWith("]")) {
        return `*${segment.slice(4, -1)}`;
      }

      if (segment.startsWith("[") && segment.endsWith("]")) {
        return `:${segment.slice(1, -1)}`;
      }

      return segment;
    });

  return `/${segments.join("/")}`;
}

function toPosix(value: string) {
  return value.split(path.sep).join("/");
}

function scoreRoute(routePath: string) {
  return routePath
    .split("/")
    .filter(Boolean)
    .reduce((score, segment) => {
      if (segment.startsWith("*")) {
        return score - 10;
      }

      if (segment.startsWith(":")) {
        return score + 1;
      }

      return score + 5;
    }, 0);
}
