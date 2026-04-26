import React from "react";
import { renderToReadableStream } from "@vitejs/plugin-rsc/rsc";
import { prerender } from "@vitejs/plugin-rsc/vendor/react-server-dom/static.edge";
import { createClientManifest } from "@vitejs/plugin-rsc/core/rsc";
import routes from "virtual:nlite/routes";
import { collectStaticPaths, createRouteElement, matchRoute } from "../runtime.js";
import type { RscPayload } from "../types.js";

function toRscPathname(pathname: string) {
  return pathname.endsWith(".rsc") ? pathname.slice(0, -4) || "/" : pathname;
}

function Document({
  children,
  pathname,
  rendering,
}: {
  children: React.ReactNode;
  pathname: string;
  rendering: string;
}) {
  return React.createElement(
    "html",
    { lang: "en" },
    React.createElement(
      "head",
      null,
      React.createElement("meta", { charSet: "utf-8" }),
      React.createElement("meta", {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      }),
      import.meta.viteRsc.loadCss(),
    ),
    React.createElement(
      "body",
      null,
      React.createElement("script", {
        dangerouslySetInnerHTML: {
          __html: getInlineRscBootstrapScript(),
        },
      }),
      React.createElement("script", {
        dangerouslySetInnerHTML: {
          __html: "window.__NLITE_DATA__=" + JSON.stringify({ pathname, rendering }),
        },
      }),
      children,
    ),
  );
}

export default async function handler(request: Request) {
  const url = new URL(request.url);
  const renderRequest = parseRenderRequest(request);
  const pathname = renderRequest.pathname;
  const match = matchRoute(routes, pathname);

  if (!match) {
    return new Response("Not Found", {
      status: 404,
      headers: { "content-type": "text/plain;charset=utf-8" },
    });
  }

  const app = createRouteElement(match.route, match.params, url.searchParams);
  const documentNode = React.createElement(Document, {
    children: app,
    pathname,
    rendering: match.route.rendering,
  });
  const rscPayload = { root: documentNode };
  const rscStream = renderToReadableStream<RscPayload>(rscPayload);

  if (renderRequest.isRsc) {
    return new Response(rscStream, {
      headers: { "content-type": "text/x-component;charset=utf-8" },
    });
  }

  const ssrEntry = await import.meta.viteRsc.loadModule<typeof import("./entry.ssr.ts")>(
    "ssr",
    "index",
  );
  const { stream: htmlStream, status } = await ssrEntry.renderHtml(rscStream, { ssg: false });

  return new Response(htmlStream, {
    status,
    headers: {
      "content-type": "text/html;charset=utf-8",
    },
  });
}

function getInlineRscBootstrapScript() {
  return [
    "(() => {",
    "  const encoder = new TextEncoder();",
    "  let controller = null;",
    "  let closed = false;",
    "  const pending = [];",
    "  const stream = new ReadableStream({",
    "    start(nextController) {",
    "      controller = nextController;",
    "      for (const chunk of pending) controller.enqueue(encoder.encode(chunk));",
    "      if (closed) controller.close();",
    "    }",
    "  });",
    "  window.__NLITE_READ_RSC__ = () => stream;",
    "  window.__NLITE_PUSH_RSC__ = (chunk) => {",
    "    if (controller) {",
    "      controller.enqueue(encoder.encode(chunk));",
    "      return;",
    "    }",
    "    pending.push(chunk);",
    "  };",
    "  window.__NLITE_CLOSE_RSC__ = () => {",
    "    closed = true;",
    "    if (controller) controller.close();",
    "  };",
    "})();",
  ].join("\n");
}

if (import.meta.hot) {
  import.meta.hot.accept();
}

export async function collectPrerenderPaths() {
  return collectStaticPaths(routes);
}

export async function handleSsg(request: Request) {
  const renderRequest = parseRenderRequest(request);
  const match = matchRoute(routes, renderRequest.pathname);

  if (!match) {
    throw new Error('Cannot prerender unknown route "' + renderRequest.pathname + '"');
  }

  const app = createRouteElement(match.route, match.params, renderRequest.url.searchParams);
  const documentNode = React.createElement(Document, {
    children: app,
    pathname: renderRequest.pathname,
    rendering: "ssg",
  });
  const rscPayload = { root: documentNode };
  const { prelude: rscStream } = await prerender<RscPayload>(rscPayload, createClientManifest());
  const [rscStream1, rscStream2] = rscStream.tee();
  const ssrEntry = await import.meta.viteRsc.loadModule<typeof import("./entry.ssr.ts")>(
    "ssr",
    "index",
  );
  const { stream: htmlStream } = await ssrEntry.renderHtml(rscStream1, { ssg: true });
  return { stream: htmlStream, rsc: rscStream2 };
}

function parseRenderRequest(request: Request) {
  const url = new URL(request.url);
  const pathname = toRscPathname(url.pathname);

  return {
    isRsc: url.pathname.endsWith(".rsc"),
    pathname,
    url,
  };
}
