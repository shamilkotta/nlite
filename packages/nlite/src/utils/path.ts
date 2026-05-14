import { RSC_POSTFIX, POSTPONED_POSTFIX } from "./constants.js";

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
    return "index" + RSC_POSTFIX;
  }

  return routePath.slice(1) + RSC_POSTFIX;
}

export function normalizePostponedFilePath(routePath: string) {
  if (routePath === "/") {
    return "index" + POSTPONED_POSTFIX;
  }

  return routePath.slice(1) + POSTPONED_POSTFIX;
}
