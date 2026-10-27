import React, { Suspense } from "react";

import { ErrorBoundary } from "./lib/error-boundary.js";
import { NotFoundBoundary } from "./lib/not-found-boundary.js";
import { RedirectBoundary } from "./lib/redirect-boundary.js";
import { trackSearchParams } from "./internal/request-context.js";
import { compileRoutePath, matchCompiledPath } from "./utils/path.js";
import type {
  NliteRouteSegmentModule,
  NlitePageModule,
  PrerenderPath,
  NliteRouteMatch,
  NliteRouteRecord,
  RenderingMode,
  RouteParams,
} from "./types.js";
import { GlobalErrorElement } from "./utils/elements/global-error.js";
import { DefaultNotFoundElement } from "./utils/elements/not-found.js";
import { DefaultRootLayout } from "./utils/elements/root-layout.js";
import { resolveRouteMetadata } from "./utils/metadata/index.js";

export type { NliteRouteMatch, NliteRouteRecord, RenderingMode, RouteParams };

export function createRouteRecord(input: {
  id: string;
  routePath: string;
  sourceFile: string;
  page: NlitePageModule;
  tree: NliteRouteSegmentModule[];
}): NliteRouteRecord {
  const rendering = input.page.rendering;
  const { regex, paramNames } = compileRoutePath(input.routePath);

  return {
    ...input,
    rendering,
    regex,
    paramNames,
  };
}

export function matchRoute(
  routes: NliteRouteRecord[],
  pathname: string,
): NliteRouteMatch | undefined {
  const matched = matchCompiledPath(routes, pathname);

  if (!matched) {
    return;
  }

  return { route: matched.route as NliteRouteRecord, params: matched.params };
}

export function createRouteElement(
  route: NliteRouteRecord,
  params: RouteParams,
  searchParams: URLSearchParams = new URLSearchParams(),
): React.ReactElement {
  const trackedSearchParams = trackSearchParams(searchParams);
  const page = React.createElement(route.page.default, {
    params: Promise.resolve(params),
    searchParams: trackedSearchParams,
  });

  return wrapSegments(route.tree, route.tree.length - 1, page, params, true);
}

/** The tree the global not-found page renders in: the root layout of `/`, or of the first route */
export function getGlobalNotFoundTree(routes: NliteRouteRecord[]): NliteRouteSegmentModule[] {
  const rootRoute = routes.find((route) => route.routePath === "/") ?? routes[0];
  return rootRoute?.tree ?? [];
}

export function createGlobalNotFoundElement(
  routes: NliteRouteRecord[],
  _searchParams: URLSearchParams = new URLSearchParams(),
): React.ReactElement {
  const tree = getGlobalNotFoundTree(routes);
  const rootIndex = Math.max(getRootLayoutIndex(tree), 0);
  const notFoundModule = tree[rootIndex]?.notFound;

  return wrapSegments(
    tree.slice(0, rootIndex + 1),
    rootIndex,
    React.createElement(notFoundModule?.default ?? DefaultNotFoundElement),
    {},
    false,
  );
}

/**
 * Index of the segment whose layout is the root layout (the one rendering `<html>` and `<body>`).
 * With route groups an app can have several root layouts, so this is the first segment that has
 * a layout rather than always `tree[0]`.
 */
export function getRootLayoutIndex(tree: NliteRouteSegmentModule[]) {
  return tree.findIndex((segment) => segment.layout);
}

/**
 * Two trees share a root layout iff their segments up to and including the root layout match, like
 * Next.js. Dynamic segments keep their directory name (`[lang]`), so param values do not matter.
 */
export function getRootLayoutKey(tree: NliteRouteSegmentModule[]) {
  const rootIndex = getRootLayoutIndex(tree);
  if (rootIndex === -1) return "";

  return (
    "/" +
    tree
      .slice(0, rootIndex + 1)
      .map((segment) => segment.segment)
      .filter(Boolean)
      .join("/")
  );
}

function wrapSegments(
  tree: NliteRouteSegmentModule[],
  fromIndex: number,
  element: React.ReactElement,
  params: RouteParams,
  includeOwnNotFound: boolean,
): React.ReactElement {
  const resolvedParams = Promise.resolve(params);
  const rootIndex = getRootLayoutIndex(tree);
  const boundaryRootIndex = Math.max(rootIndex, 0);

  for (let index = fromIndex; index >= 0; index -= 1) {
    const segment = tree[index]!;

    // Boundaries above the root layout would render outside <html>, so they are ignored
    if (index < boundaryRootIndex) {
      continue;
    }

    const ownsNotFound = index !== fromIndex || includeOwnNotFound;
    // The root layout segment always gets a not-found boundary, falling back to the default UI
    if (ownsNotFound && (segment.notFound || index === boundaryRootIndex)) {
      element = React.createElement(NotFoundBoundary, {
        children: element,
        notFound: React.createElement(segment.notFound?.default ?? DefaultNotFoundElement),
      });
    }
    if (segment.loading) {
      element = React.createElement(Suspense, {
        children: element,
        fallback: React.createElement(segment.loading.default),
      });
    }
    if (segment.error) {
      element = React.createElement(ErrorBoundary, {
        children: element,
        FallbackComponent: segment.error.default,
      });
    }
    if (segment.layout) {
      element = React.createElement(segment.layout.default, {
        children: element,
        params: resolvedParams,
      });
    }
  }

  if (rootIndex === -1) {
    element = React.createElement(DefaultRootLayout, { children: element });
  }

  return React.createElement(ErrorBoundary, {
    children: React.createElement(RedirectBoundary, { children: element }),
    FallbackComponent: GlobalErrorElement,
  });
}

export async function resolveGlobalNotFoundMetadata(
  routeRecords: NliteRouteRecord[],
  searchParams: URLSearchParams,
) {
  const rootRoute = routeRecords.find((route) => route.routePath === "/");

  if (!rootRoute) {
    return { title: "404: This page could not be found" };
  }

  const resolved = await resolveRouteMetadata(rootRoute, {}, searchParams, {
    includePage: false,
  });

  return {
    title: resolved.title ?? "404: This page could not be found",
    ...resolved,
  };
}

export async function collectStaticPaths(routes: NliteRouteRecord[]) {
  const output: PrerenderPath[] = [];

  for (const route of routes) {
    if (route.rendering === "force-ssr") {
      continue;
    }

    const generator = route.page.generateStaticParams;

    if (!generator) {
      if (route.paramNames.length > 0) {
        if (route.rendering === "force-ssg") {
          throw new Error(
            `Route "${route.routePath}" uses force-ssg but does not export generateStaticParams()`,
          );
        }

        continue;
      }

      output.push({
        path: route.routePath,
        forcePrerender: route.rendering === "force-ssg",
      });
      continue;
    }

    const paramsList = await generator();

    for (const params of paramsList) {
      output.push({
        path: interpolateRoutePath(route.routePath, params),
        forcePrerender: true,
      });
    }
  }

  return output;
}

function interpolateRoutePath(routePath: string, params: RouteParams) {
  if (routePath === "/") {
    return "/";
  }

  const segments = routePath.split("/").filter(Boolean);

  return `/${segments
    .map((segment) => {
      if (segment.startsWith(":")) {
        return encodeURIComponent(String(params[segment.slice(1)] ?? ""));
      }

      if (segment.startsWith("*")) {
        const value = params[segment.slice(1)];
        return Array.isArray(value)
          ? value.map((item) => encodeURIComponent(item)).join("/")
          : encodeURIComponent(String(value ?? ""));
      }

      return segment;
    })
    .join("/")}`;
}
