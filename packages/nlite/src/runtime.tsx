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
import { DefaultNotFoundElement } from "./utils/elements.js";

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
  let element: React.ReactElement = React.createElement(route.page.default, {
    params: Promise.resolve(params),
    searchParams: trackedSearchParams,
  });

  for (const segment of [...route.tree].reverse()) {
    if (segment.notFound) {
      element = React.createElement(NotFoundBoundary, {
        children: element,
        notFound: React.createElement(segment.notFound.default),
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
        params: Promise.resolve(params),
        searchParams: trackedSearchParams,
      });
    }
  }

  return React.createElement(RedirectBoundary, { children: element });
}

export function createRouteNotFoundElement(
  route: NliteRouteRecord,
  params: RouteParams,
  searchParams: URLSearchParams = new URLSearchParams(),
): React.ReactElement {
  const trackedSearchParams = trackSearchParams(searchParams);
  const resolvedParams = Promise.resolve(params);
  let notFoundSegmentIndex = -1;

  for (let index = route.tree.length - 1; index >= 0; index -= 1) {
    if (route.tree[index]?.notFound) {
      notFoundSegmentIndex = index;
      break;
    }
  }

  if (notFoundSegmentIndex === -1) {
    return createGlobalNotFoundElement([route], searchParams);
  }

  const notFoundModule = route.tree[notFoundSegmentIndex]?.notFound;
  let element: React.ReactElement = React.createElement(notFoundModule!.default);

  for (let index = notFoundSegmentIndex; index >= 0; index -= 1) {
    const segment = route.tree[index];

    if (segment.notFound && index !== notFoundSegmentIndex) {
      element = React.createElement(NotFoundBoundary, {
        children: element,
        notFound: React.createElement(segment.notFound.default),
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

    if (segment?.layout) {
      element = React.createElement(segment.layout.default, {
        children: element,
        params: resolvedParams,
        searchParams: trackedSearchParams,
      });
    }
  }

  return React.createElement(RedirectBoundary, { children: element });
}

export function createGlobalNotFoundElement(
  routes: NliteRouteRecord[],
  searchParams: URLSearchParams = new URLSearchParams(),
): React.ReactElement {
  const rootRoute = routes.find((route) => route.routePath === "/");

  const trackedSearchParams = trackSearchParams(searchParams);
  const params = Promise.resolve({});
  const rootSegment = rootRoute?.tree?.[0];
  const notFoundModule = rootSegment?.notFound;

  let element: React.ReactElement = notFoundModule
    ? React.createElement(notFoundModule.default)
    : React.createElement(DefaultNotFoundElement);

  if (rootSegment?.loading) {
    element = React.createElement(Suspense, {
      children: element,
      fallback: React.createElement(rootSegment.loading.default),
    });
  }

  if (rootSegment?.error) {
    element = React.createElement(ErrorBoundary, {
      children: element,
      FallbackComponent: rootSegment.error.default,
    });
  }

  if (rootSegment?.layout) {
    element = React.createElement(rootSegment.layout.default, {
      children: element,
      params,
      searchParams: trackedSearchParams,
    });
  }

  return React.createElement(RedirectBoundary, { children: element });
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
