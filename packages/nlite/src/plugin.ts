import path from "node:path";

import react from "@vitejs/plugin-react";
import rsc from "@vitejs/plugin-rsc";
import type { Plugin, PluginOption, ViteDevServer } from "vite";

import { discoverRoutes } from "./fs-routes.js";
import type { NliteOptions } from "./types.js";

const VIRTUAL_MANIFEST_ID = "virtual:nlite/routes";
const VIRTUAL_RSC_ENTRY_ID = "virtual:nlite/entry-rsc.tsx";
const VIRTUAL_SSR_ENTRY_ID = "virtual:nlite/entry-ssr.tsx";
const VIRTUAL_BROWSER_ENTRY_ID = "virtual:nlite/entry-browser.tsx";

const RESOLVED_IDS = new Map([
  [VIRTUAL_MANIFEST_ID, `\0${VIRTUAL_MANIFEST_ID}`],
  [VIRTUAL_RSC_ENTRY_ID, `\0${VIRTUAL_RSC_ENTRY_ID}`],
  [VIRTUAL_SSR_ENTRY_ID, `\0${VIRTUAL_SSR_ENTRY_ID}`],
  [VIRTUAL_BROWSER_ENTRY_ID, `\0${VIRTUAL_BROWSER_ENTRY_ID}`],
]);
const INTERNAL_VIRTUAL_IDS = new Set(RESOLVED_IDS.values());

export function nlite(options: NliteOptions = {}): PluginOption[] {
  const appDir = options.appDir ?? "app";
  const extensions = options.extensions ?? ["tsx", "ts", "jsx", "js"];
  let projectRoot = process.cwd();

  const frameworkPlugin: Plugin = {
    name: "nlite:v2",
    enforce: "pre",
    configResolved(config) {
      projectRoot = config.root;
    },
    configureServer(server) {
      const appRoot = path.resolve(server.config.root, appDir);

      server.watcher.add(appRoot);
      server.watcher.on("add", (file) => invalidateRoutes(server, appRoot, file));
      server.watcher.on("unlink", (file) => invalidateRoutes(server, appRoot, file));
    },
    resolveId(id) {
      if (INTERNAL_VIRTUAL_IDS.has(id)) {
        return id;
      }

      return RESOLVED_IDS.get(id);
    },
    async load(id) {
      if (id === RESOLVED_IDS.get(VIRTUAL_MANIFEST_ID)) {
        const routes = await discoverRoutes(projectRoot, appDir, extensions);

        return buildManifestModule(routes);
      }

      if (id === RESOLVED_IDS.get(VIRTUAL_RSC_ENTRY_ID)) {
        return buildRscEntryModule();
      }

      if (id === RESOLVED_IDS.get(VIRTUAL_SSR_ENTRY_ID)) {
        return buildSsrEntryModule();
      }

      if (id === RESOLVED_IDS.get(VIRTUAL_BROWSER_ENTRY_ID)) {
        return buildBrowserEntryModule();
      }

      return undefined;
    },
  };

  return [
    frameworkPlugin,
    react(),
    rsc({
      entries: {
        rsc: VIRTUAL_RSC_ENTRY_ID,
        ssr: VIRTUAL_SSR_ENTRY_ID,
        client: VIRTUAL_BROWSER_ENTRY_ID,
      },
    }),
  ];
}

function invalidateRoutes(server: ViteDevServer, appRoot: string, file: string) {
  if (!file.startsWith(appRoot)) {
    return;
  }

  const manifestModule = server.moduleGraph.getModuleById(RESOLVED_IDS.get(VIRTUAL_MANIFEST_ID)!);

  if (manifestModule) {
    server.moduleGraph.invalidateModule(manifestModule);
  }

  server.ws.send({ type: "full-reload" });
}

function buildManifestModule(routes: Awaited<ReturnType<typeof discoverRoutes>>) {
  const imports: string[] = ['import { createRouteRecord } from "nlite/runtime";'];
  const records: string[] = [];

  routes.forEach((route, index) => {
    const pageVar = `pageModule${index}`;
    imports.push(`import * as ${pageVar} from ${JSON.stringify(route.page)};`);

    const layoutVars: string[] = [];
    route.layouts.forEach((layoutFile, layoutIndex) => {
      const layoutVar = `layout${index}_${layoutIndex}`;
      layoutVars.push(layoutVar);
      imports.push(`import * as ${layoutVar} from ${JSON.stringify(layoutFile)};`);
    });

    records.push(`createRouteRecord({
  id: ${JSON.stringify(route.id)},
  routePath: ${JSON.stringify(route.routePath)},
  sourceFile: ${JSON.stringify(route.page)},
  page: ${pageVar},
  layouts: [${layoutVars.join(", ")}]
})`);
  });

  return `${imports.join("\n")}

export const routes = [
  ${records.join(",\n  ")}
];

export default routes;
`;
}

function buildRscEntryModule() {
  return `import React from "react";
import { renderToReadableStream } from "@vitejs/plugin-rsc/rsc";
import routes from "virtual:nlite/routes";
import { createRouteElement, matchRoute } from "nlite/runtime";

function toRscPathname(pathname) {
  return pathname.endsWith(".rsc")
    ? pathname.slice(0, -4) || "/"
    : pathname;
}

function Document({ children, pathname, rendering }) {
  return React.createElement(
    "html",
    { lang: "en" },
    React.createElement(
      "head",
      null,
      React.createElement("meta", { charSet: "utf-8" }),
      React.createElement("meta", {
        name: "viewport",
        content: "width=device-width, initial-scale=1"
      }),
      import.meta.viteRsc.loadCss()
    ),
    React.createElement(
      "body",
      null,
      React.createElement("script", {
        dangerouslySetInnerHTML: {
          __html: getInlineRscBootstrapScript()
        }
      }),
      React.createElement("script", {
        dangerouslySetInnerHTML: {
          __html: "window.__NLITE_DATA__=" + JSON.stringify({ pathname, rendering })
        }
      }),
      children
    )
  );
}

export default async function handler(request) {
  const url = new URL(request.url);
  const pathname = toRscPathname(url.pathname);
  const match = matchRoute(routes, pathname);

  if (!match) {
    return new Response("Not Found", {
      status: 404,
      headers: { "content-type": "text/plain;charset=utf-8" }
    });
  }

  const app = createRouteElement(match.route, match.params);
  const documentNode = React.createElement(
    Document,
    { pathname, rendering: match.route.rendering },
    app
  );
  const rscStream = renderToReadableStream(documentNode);

  if (url.pathname.endsWith(".rsc")) {
    return new Response(rscStream, {
      headers: { "content-type": "text/x-component;charset=utf-8" }
    });
  }

  const [ssrRscStream, browserRscStream] = rscStream.tee();
  const ssrEntry = await import.meta.viteRsc.loadModule("ssr", "index");
  const htmlStream = await ssrEntry.renderHtml(ssrRscStream);

  return new Response(
    createHtmlWithInlineRscStream(htmlStream, browserRscStream),
    {
      headers: { "content-type": "text/html;charset=utf-8" }
    }
  );
}

function getInlineRscBootstrapScript() {
  return [
    "(() => {",
    '  const encoder = new TextEncoder();',
    '  let controller = null;',
    '  let closed = false;',
    '  const pending = [];',
    '  const stream = new ReadableStream({',
    '    start(nextController) {',
    '      controller = nextController;',
    '      for (const chunk of pending) controller.enqueue(encoder.encode(chunk));',
    '      if (closed) controller.close();',
    '    }',
    '  });',
    '  window.__NLITE_READ_RSC__ = () => stream;',
    '  window.__NLITE_PUSH_RSC__ = (chunk) => {',
    '    if (controller) {',
    '      controller.enqueue(encoder.encode(chunk));',
    '      return;',
    '    }',
    '    pending.push(chunk);',
    '  };',
    '  window.__NLITE_CLOSE_RSC__ = () => {',
    '    closed = true;',
    '    if (controller) controller.close();',
    '  };',
    "})();"
  ].join("\\n");
}

function createHtmlWithInlineRscStream(htmlStream, rscStream) {
  const encoder = new TextEncoder();
  const decodedRscStream = rscStream.pipeThrough(new TextDecoderStream());

  return new ReadableStream({
    async start(controller) {
      await pipeStream(htmlStream, controller);
      await pipeInlineRscScripts(decodedRscStream, controller, encoder);
      controller.close();
    }
  });
}

async function pipeStream(stream, controller) {
  const reader = stream.getReader();

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      return;
    }

    controller.enqueue(value);
  }
}

async function pipeInlineRscScripts(stream, controller, encoder) {
  const reader = stream.getReader();

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      controller.enqueue(
        encoder.encode(
          "<script>window.__NLITE_CLOSE_RSC__&&window.__NLITE_CLOSE_RSC__()</script>"
        )
      );
      return;
    }

    controller.enqueue(
      encoder.encode(
        "<script>window.__NLITE_PUSH_RSC__&&window.__NLITE_PUSH_RSC__(" +
          serializeInlineScriptValue(value) +
          ")</script>"
      )
    );
  }
}

function serializeInlineScriptValue(value) {
  return JSON.stringify(value)
    .replace(/</g, "\\\\u003C")
    .replace(/\\u2028/g, "\\\\u2028")
    .replace(/\\u2029/g, "\\\\u2029");
}

if (import.meta.hot) {
  import.meta.hot.accept();
}
`;
}

function buildSsrEntryModule() {
  return `import { createFromReadableStream } from "@vitejs/plugin-rsc/ssr";
import { renderToReadableStream } from "react-dom/server.edge";

export async function renderHtml(rscStream) {
  const root = await createFromReadableStream(rscStream);
  const bootstrapScriptContent =
    await import.meta.viteRsc.loadBootstrapScriptContent("index");

  return renderToReadableStream(root, {
    bootstrapScriptContent
  });
}

if (import.meta.hot) {
  import.meta.hot.accept();
}
`;
}

function buildBrowserEntryModule() {
  return `import { bootNavigation } from "nlite/navigation";

bootNavigation();
`;
}
