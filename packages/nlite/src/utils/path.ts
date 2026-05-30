import type { RouteParams } from "../types.js";
import { RSC_POSTFIX } from "./constants.js";

export function normalizeRoutePath(routePath: string) {
  if (!routePath || routePath === "/") {
    return "/";
  }

  const withLeadingSlash = routePath.startsWith("/") ? routePath : `/${routePath}`;
  return withLeadingSlash.endsWith("/") ? withLeadingSlash.slice(0, -1) : withLeadingSlash;
}

export function normalizeHtmlFilePath(routePath: string) {
  if (routePath === "/") {
    return "index.html";
  }

  return routePath.slice(1) + ".html";
}

export function normalizeRscFilePath(routePath: string) {
  if (routePath === "/") {
    return "" + RSC_POSTFIX;
  }

  return routePath.slice(1) + RSC_POSTFIX;
}

export function compileRoutePath(routePath: string) {
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

export function matchCompiledPath(
  routes: { routePath: string; regex: string; paramNames: string[] }[],
  pathname: string,
) {
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

  return;
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
