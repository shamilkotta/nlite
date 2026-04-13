import React from "react";

import type {
  NliteLayoutModule,
  NlitePageModule,
  NliteRouteMatch,
  NliteRouteRecord,
  RenderingMode,
  RouteParams
} from "./types.js";

export type { NliteRouteMatch, NliteRouteRecord, RenderingMode, RouteParams };

export function createRouteRecord(input: {
  id: string;
  routePath: string;
  sourceFile: string;
  page: NlitePageModule;
  layouts: NliteLayoutModule[];
  loading?: unknown;
  error?: unknown;
}): NliteRouteRecord {
  const rendering = input.page.rendering ?? "ssr";
  const { regex, paramNames } = compileRoutePath(input.routePath);

  return {
    ...input,
    rendering,
    regex,
    paramNames
  };
}

export function matchRoute(
  routes: NliteRouteRecord[],
  pathname: string
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
  params: RouteParams
) {
  let element = React.createElement(route.page.default, { params });

  for (const layout of [...route.layouts].reverse()) {
    element = React.createElement(layout.default, { children: element, params });
  }

  return element;
}

export async function collectStaticPaths(routes: NliteRouteRecord[]) {
  const output: string[] = [];

  for (const route of routes) {
    if (route.rendering !== "ssg") {
      continue;
    }

    const generator = route.page.generateStaticParams;

    if (!generator) {
      output.push(route.routePath);
      continue;
    }

    const paramsList = await generator();

    for (const params of paramsList) {
      output.push(interpolateRoutePath(route.routePath, params));
    }
  }

  return output;
}

function compileRoutePath(routePath: string) {
  if (routePath === "/") {
    return {
      regex: "^/$",
      paramNames: []
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
    paramNames
  };
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

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
