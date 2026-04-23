import { access } from "node:fs/promises";
import path from "node:path";

import { FILE_EXTENSIONS } from "./utils/constants.js";
import { glob } from "tinyglobby";

export interface RouteModuleFiles {
  page: string;
  tree: {
    layout?: string;
    loading?: string;
    error?: string;
  }[];
}

export interface DiscoveredRoute extends RouteModuleFiles {
  id: string;
  routePath: string;
}

export async function discoverRoutes(projectRoot: string, appDir = "app") {
  const appRoot = path.resolve(projectRoot, appDir);
  const pagePattern = `**/page.{${FILE_EXTENSIONS.join(",")}}`;
  const pageFiles = await glob(pagePattern, {
    cwd: appRoot,
    absolute: true,
    onlyFiles: true,
  });

  const routes: DiscoveredRoute[] = [];

  for (const pageFile of pageFiles.sort()) {
    const pageDir = path.dirname(pageFile);
    const tree = await collectTree(appRoot, pageDir);

    routes.push({
      id: toPosix(path.relative(projectRoot, pageFile)),
      routePath: toRoutePath(appRoot, pageFile),
      page: pageFile,
      tree,
    });
  }

  return routes.sort((left, right) => scoreRoute(right.routePath) - scoreRoute(left.routePath));
}

async function collectTree(appRoot: string, pageDir: string) {
  const tree = [];
  let currentDir = pageDir;

  while (currentDir.startsWith(appRoot)) {
    const layout = await findConventionFile(currentDir, "layout");
    const loading = await findConventionFile(currentDir, "loading");
    const error = await findConventionFile(currentDir, "error");
    // TODO: not found file

    const currentSegement = {
      layout,
      loading,
      error,
    };
    tree.unshift(currentSegement);

    if (currentDir === appRoot) {
      break;
    }

    currentDir = path.dirname(currentDir);
  }

  return tree;
}

async function findConventionFile(dir: string, basename: string) {
  for (const extension of FILE_EXTENSIONS) {
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
