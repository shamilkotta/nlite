import { H3, defineHandler, getRouterParams, type H3 as H3App } from "h3";

import { compileRoutePath, matchCompiledPath } from "./utils/path.js";
import type { ApiRouteContext, ApiRouteModule, HttpMethod, ApiRouteRecord } from "./types.js";
import type { RouteParams } from "./types.js";

export const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"] as const;

export function createApiRouteRecord(input: {
  id: string;
  routePath: string;
  sourceFile: string;
  module: ApiRouteModule;
}): ApiRouteRecord {
  const { regex, paramNames } = compileRoutePath(input.routePath);

  return {
    ...input,
    regex,
    paramNames,
    catchAllParamNames: getCatchAllParamNames(input.routePath),
    h3RoutePath: toH3RoutePath(input.routePath),
  };
}

export function registerApiRoute(app: H3, route: ApiRouteRecord) {
  app.all(
    route.h3RoutePath,
    defineHandler(async (event) => {
      const method = event.req.method as HttpMethod;
      const handler = route.module[method];
      const allowedMethods = HTTP_METHODS.filter(
        (name) => typeof route.module[name] === "function",
      );

      if (!handler) {
        return new Response(JSON.stringify({ message: "Method Not Allowed" }), {
          status: 405,
          headers: {
            "content-type": "application/json;charset=utf-8",
            Allow: allowedMethods.join(", "),
          },
        });
      }

      const params = routeParamsFromH3(getRouterParams(event), route.catchAllParamNames);
      const response = await handler(event.req, {
        params: Promise.resolve(params),
      } satisfies ApiRouteContext);

      return response;
    }),
  );
}

export function createApiApp(routes: ApiRouteRecord[]): H3App {
  const app = new H3();

  for (const route of routes) {
    registerApiRoute(app, route);
  }

  return app;
}

export function createApiMatcher(
  routes: Pick<ApiRouteRecord, "regex" | "paramNames" | "routePath">[],
) {
  return (pathname: string) => Boolean(matchCompiledPath(routes, pathname));
}

function routeParamsFromH3(
  h3Params: Record<string, string> | undefined,
  catchAllParamNames: string[],
) {
  const params: RouteParams = { ...h3Params };

  if (catchAllParamNames.length > 0 && typeof params._ === "string") {
    const catchAllName = catchAllParamNames[0]!;
    params[catchAllName] = params._.split("/").filter(Boolean);
    delete params._;
  }

  return params;
}

function getCatchAllParamNames(routePath: string) {
  return routePath
    .split("/")
    .filter(Boolean)
    .filter((segment) => segment.startsWith("*"))
    .map((segment) => segment.slice(1));
}

function toH3RoutePath(routePath: string) {
  if (routePath === "/") {
    return "/";
  }

  const segments = routePath.split("/").filter(Boolean);

  return `/${segments
    .map((segment) => {
      if (segment.startsWith("*")) {
        return "**";
      }

      return segment;
    })
    .join("/")}`;
}
