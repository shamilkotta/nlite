import path from "node:path";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import rsc from "@vitejs/plugin-rsc";
import type { ModuleNode, Plugin, PluginOption, ViteDevServer } from "vite";

import { discoverRoutes } from "./fs-routes.js";
import type { NliteOptions } from "./types.js";
import { prerender } from "./prerender.plugin.js";

const VIRTUAL_MANIFEST_ID = "virtual:nlite/routes";
const VIRTUAL_RUNTIME_ID = "virtual:nlite/runtime";

const RESOLVED_IDS = new Map([
  [VIRTUAL_MANIFEST_ID, `\0${VIRTUAL_MANIFEST_ID}`],
  [VIRTUAL_RUNTIME_ID, `\0${VIRTUAL_RUNTIME_ID}`],
]);
const INTERNAL_VIRTUAL_IDS = new Set(RESOLVED_IDS.values());

export function nlite(options: NliteOptions = {}): PluginOption[] {
  const appDir = options.appDir ?? "app";
  let projectRoot = process.cwd();

  const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
      server.watcher.on("addDir", (file) => invalidateRoutes(server, appRoot, file));
      server.watcher.on("unlinkDir", (file) => invalidateRoutes(server, appRoot, file));
    },
    resolveId(id) {
      if (INTERNAL_VIRTUAL_IDS.has(id)) {
        return id;
      }

      return RESOLVED_IDS.get(id);
    },
    async load(id) {
      if (id === RESOLVED_IDS.get(VIRTUAL_MANIFEST_ID)) {
        const routes = await discoverRoutes(projectRoot, appDir);

        return buildManifestModule(routes);
      }

      if (id === RESOLVED_IDS.get(VIRTUAL_RUNTIME_ID)) {
        return await readFile(path.join(__dirname, "runtime.mjs"), "utf8");
      }

      return undefined;
    },
  };

  return [
    frameworkPlugin,
    react(),
    rsc({
      entries: {
        rsc: path.join(__dirname, "modules", "entry.rsc"),
        ssr: path.join(__dirname, "modules", "entry.ssr"),
        client: path.join(__dirname, "modules", "entry.browser"),
      },
    }),
    prerender(),
  ];
}

function invalidateRoutes(server: ViteDevServer, appRoot: string, file: string) {
  const relative = path.relative(appRoot, file);
  const isWithinAppRoot =
    relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));

  if (!isWithinAppRoot) {
    return;
  }

  invalidateManifestModuleGraph(server.moduleGraph);
  invalidateManifestInAllEnvironments(server);
}

function invalidateManifestModuleGraph(moduleGraph: {
  getModuleById: (id: string) => ModuleNode | undefined;
  invalidateModule: (mod: ModuleNode) => void;
}) {
  const manifestModule = moduleGraph.getModuleById(RESOLVED_IDS.get(VIRTUAL_MANIFEST_ID)!);

  if (manifestModule) {
    moduleGraph.invalidateModule(manifestModule);
  }
}

function invalidateManifestInAllEnvironments(server: ViteDevServer) {
  const environments = (server as { environments?: Record<string, unknown> }).environments;

  if (!environments) {
    return;
  }

  for (const environment of Object.values(environments)) {
    if (!environment || typeof environment !== "object" || !("moduleGraph" in environment)) {
      continue;
    }

    const { moduleGraph } = environment as { moduleGraph?: unknown };

    if (
      !moduleGraph ||
      typeof moduleGraph !== "object" ||
      !("getModuleById" in moduleGraph) ||
      !("invalidateModule" in moduleGraph)
    ) {
      continue;
    }

    invalidateManifestModuleGraph(
      moduleGraph as {
        getModuleById: (id: string) => ModuleNode | undefined;
        invalidateModule: (mod: ModuleNode) => void;
      },
    );
  }
}

function buildManifestModule(routes: Awaited<ReturnType<typeof discoverRoutes>>) {
  const imports: string[] = [`import { createRouteRecord } from "virtual:nlite/runtime";`];
  const records: string[] = [];

  routes.forEach((route, index) => {
    const pageVar = `pageModule${index}`;
    imports.push(`import * as ${pageVar} from ${JSON.stringify(route.page)};`);

    const treeVars: {
      layout?: string;
      loading?: string;
      error?: string;
    }[] = [];
    route.tree.forEach((segment, segmentIndex) => {
      const currentVar: (typeof treeVars)[number] = {};
      if (segment.layout) {
        const layoutVar = `layout${index}_${segmentIndex}`;
        currentVar.layout = layoutVar;
        imports.push(`import * as ${layoutVar} from ${JSON.stringify(segment.layout)};`);
      }
      if (segment.loading) {
        const loadingVar = `loading${index}_${segmentIndex}`;
        currentVar.loading = loadingVar;
        imports.push(`import * as ${loadingVar} from ${JSON.stringify(segment.loading)};`);
      }
      if (segment.error) {
        const errorVar = `error${index}_${segmentIndex}`;
        currentVar.error = errorVar;
        imports.push(`import * as ${errorVar} from ${JSON.stringify(segment.error)};`);
      }
      treeVars.push(currentVar);
    });

    const treeRecord = treeVars
      .map((segment) => {
        const entries: string[] = [];

        if (segment.layout) {
          entries.push(`layout: ${segment.layout}`);
        }
        if (segment.loading) {
          entries.push(`loading: ${segment.loading}`);
        }
        if (segment.error) {
          entries.push(`error: ${segment.error}`);
        }

        return `{ ${entries.join(", ")} }`;
      })
      .join(",\n    ");

    records.push(`createRouteRecord({
  id: ${JSON.stringify(route.id)},
  routePath: ${JSON.stringify(route.routePath)},
  sourceFile: ${JSON.stringify(route.page)},
  page: ${pageVar},
  tree: [
    ${treeRecord}
  ]
})`);
  });

  return `${imports.join("\n")}

export const routes = [
  ${records.join(",\n  ")}
];

export default routes;
`;
}
