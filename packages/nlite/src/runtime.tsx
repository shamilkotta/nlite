import React, { Suspense } from "react";

import { ErrorBoundary } from "./lib/errorBoundary.js";
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
) {
  const trackedSearchParams = trackSearchParams(searchParams);
  let element: React.ReactElement = React.createElement(route.page.default, {
    params: Promise.resolve(params),
    searchParams: trackedSearchParams,
  });

  for (const segment of [...route.tree].reverse()) {
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
        params: Promise.resolve(params),
        searchParams: trackedSearchParams,
      });
    }
  }

  return element;
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
