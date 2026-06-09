import type { RouteMetadata } from "../types.js";

export function createRouteMetadata(pathname: string): RouteMetadata {
  const title =
    pathname === "/" ? "nlite" : `nlite · ${pathname.replace(/^\//, "") || "home"}`;

  return {
    pathname,
    title,
    description: "Built with nlite",
  };
}
