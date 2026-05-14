import React, { Suspense } from "react";

import { ErrorBoundary } from "./lib/errorBoundary.js";
import type {
  NliteRouteSegmentModule,
  NlitePageModule,
  NliteRouteMatch,
  NliteRouteRecord,
  RouteParams,
} from "./types.js";

export type { NliteRouteMatch, NliteRouteRecord, RouteParams };

export function createRouteRecord(input: {
  id: string;
  routePath: string;
  sourceFile: string;
  page: NlitePageModule;
  tree: NliteRouteSegmentModule[];
}): NliteRouteRecord {
  const { regex, paramNames } = compileRoutePath(input.routePath);

  return {
    ...input,
    regex,
    paramNames,
  };
}

export function matchRoute(
  routes: NliteRouteRecord[],
  pathname: string,
): NliteRouteMatch | undefined {
  for (const route of routes) {
    const match = pathname.match(new RegExp(route.regex));

    if (!match) {
      continue;
    }

    const params: RouteParams = {};

    route.paramNames.forEach((name, index) => {
      const value = decodeURIComponent(match[index + 1] ?? "");
      params[name] = route.routePath.includes(`*${name}`)
        ? value.split("/").filter(Boolean)
        : value;
    });

    return { route, params };
  }

  return undefined;
}

export function createRouteElement(
  route: NliteRouteRecord,
  params: RouteParams,
  searchParams: URLSearchParams = new URLSearchParams(),
) {
  let element: React.ReactElement = React.createElement(route.page.default, {
    params: Promise.resolve(params),
    searchParams: Promise.resolve(searchParams),
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
        searchParams: Promise.resolve(searchParams),
      });
    }
  }

  return element;
}

function compileRoutePath(routePath: string) {
  if (routePath === "/") {
    return {
      regex: "^/$",
      paramNames: [],
    };
  }

  const paramNames: string[] = [];
  const segments = routePath.split("/").filter(Boolean);
  const regexSegments = segments.map((segment) => {
    if (segment.startsWith(":")) {
      paramNames.push(segment.slice(1));
      return "([^/]+)";
    }

    if (segment.startsWith("*")) {
      paramNames.push(segment.slice(1));
      return "(.*)";
    }

    return escapeRegex(segment);
  });

  return {
    regex: `^/${regexSegments.join("/")}$`,
    paramNames,
  };
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
