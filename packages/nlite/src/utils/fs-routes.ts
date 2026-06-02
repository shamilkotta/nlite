import { access } from "node:fs/promises";
import path from "node:path";

import { FILE_EXTENSIONS } from "./constants.js";
import { glob } from "tinyglobby";
import { tryCatch } from "./index.js";

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

export interface DiscoveredApiRoute {
  id: string;
  routePath: string;
  routeFile: string;
}

export async function discoverRoutes(projectRoot: string, appDir = "app") {
  const appRoot = path.resolve(projectRoot, appDir);
  const pageFiles = await glob(`**/page.{${FILE_EXTENSIONS.join(",")}}`, {
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

export async function discoverApiRoutes(projectRoot: string, appDir = "app") {
  const appRoot = path.resolve(projectRoot, appDir);
  const apiRoot = path.resolve(appRoot, "api");
  const routeFiles = await glob(`**/route.{${FILE_EXTENSIONS.join(",")}}`, {
    cwd: apiRoot,
    absolute: true,
    onlyFiles: true,
  });

  const routes: DiscoveredApiRoute[] = routeFiles.sort().map((routeFile) => ({
    id: toPosix(path.relative(projectRoot, routeFile)),
    routePath: toRoutePath(appRoot, routeFile),
    routeFile,
  }));

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

    const [_, error] = await tryCatch(access(candidate));
    if (error) continue;
    return candidate;
  }

  return;
}

function toRoutePath(appRoot: string, conventionFile: string) {
  const relativeDir = path.relative(appRoot, path.dirname(conventionFile));

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

export function toPosix(value: string) {
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
