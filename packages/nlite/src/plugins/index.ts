import path from "node:path";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import rsc from "@vitejs/plugin-rsc";
import type { ConfigEnv, ModuleNode, Plugin, PluginOption, ViteDevServer } from "vite";

import { api } from "./api.js";
import { resolveStaleTimes } from "../utils/constants.js";
import { discoverRoutes } from "../utils/fs-routes.js";
import { prerender } from "./prerender.js";
import type { NliteOptions } from "../types.js";

const VIRTUAL_MANIFEST_ID = "virtual:nlite/routes";
const VIRTUAL_RUNTIME_ID = "virtual:nlite/runtime";
const RESOLVED_MANIFEST_ID = `\0${VIRTUAL_MANIFEST_ID}`;

interface ModuleGraphLike {
  getModuleById(id: string): ModuleNode | undefined;
  invalidateModule(mod: ModuleNode): void;
}

export function nlite(options: NliteOptions = {}): PluginOption[] {
  const appDir = options.appDir ?? "app";
  let projectRoot = process.cwd();
  let isProductionBuild = false;

  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const runtimeId = path.join(__dirname, "runtime.mjs");

  const frameworkPlugin: Plugin = {
    name: "nlite",
    enforce: "pre",
    applyToEnvironment(environment) {
      return environment.name !== "api";
    },
    config(_config, env: ConfigEnv) {
      isProductionBuild = env.command === "build" && env.mode === "production";
      return {
        define: {
          __NLITE_STALE_TIMES__: JSON.stringify(resolveStaleTimes(options.staleTimes)),
        },
      };
    },
    configResolved(config) {
      projectRoot = config.root;
    },
    configEnvironment(name, config) {
      if (isProductionBuild && (name === "ssr" || name === "rsc")) {
        config.define ??= {};
        config.define["process.env.NODE_ENV"] = JSON.stringify("production");
      }

      if (config.optimizeDeps?.include) {
        config.optimizeDeps.include = config.optimizeDeps.include.map((entry) => {
          if (entry.startsWith("@vitejs/plugin-rsc")) {
            entry = `nlite > ${entry}`;
          }
          return entry;
        });
      }
    },
    configureServer(server) {
      const appRoot = path.resolve(server.config.root, appDir);

      watchRouteFiles(server, appRoot);
    },
    resolveId(id) {
      if (id === RESOLVED_MANIFEST_ID || id === runtimeId) {
        return id;
      }

      if (id === VIRTUAL_MANIFEST_ID) {
        return RESOLVED_MANIFEST_ID;
      }

      if (id === VIRTUAL_RUNTIME_ID) {
        return runtimeId;
      }

      return;
    },
    async load(id) {
      if (id === RESOLVED_MANIFEST_ID) {
        const routes = await discoverRoutes(projectRoot, appDir);
        return buildManifestModule(routes);
      }

      return;
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
    prerender(options),
    api(options),
  ];
}

function watchRouteFiles(server: ViteDevServer, appRoot: string) {
  server.watcher.add(appRoot);

  const invalidateChangedRoute = (file: string) => invalidateRoutes(server, appRoot, file);

  server.watcher.on("add", invalidateChangedRoute);
  server.watcher.on("unlink", invalidateChangedRoute);
  server.watcher.on("addDir", invalidateChangedRoute);
  server.watcher.on("unlinkDir", invalidateChangedRoute);
}

function invalidateRoutes(server: ViteDevServer, appRoot: string, file: string) {
  const relative = path.relative(appRoot, file);
  const isWithinAppRoot =
    relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));

  if (!isWithinAppRoot) {
    return;
  }

  invalidateVirtualModule(server.moduleGraph);
  invalidateVirtualModulesInAllEnvironments(server);
}

function invalidateVirtualModule(moduleGraph: ModuleGraphLike) {
  const manifestModule = moduleGraph.getModuleById(RESOLVED_MANIFEST_ID);

  if (manifestModule) {
    moduleGraph.invalidateModule(manifestModule);
  }
}

function invalidateVirtualModulesInAllEnvironments(server: ViteDevServer) {
  const environments = (server as { environments?: Record<string, unknown> }).environments;

  if (!environments) {
    return;
  }

  for (const environment of Object.values(environments)) {
    const moduleGraph = getEnvironmentModuleGraph(environment);
    if (!moduleGraph) {
      continue;
    }

    invalidateVirtualModule(moduleGraph);
  }
}

function getEnvironmentModuleGraph(environment: unknown): ModuleGraphLike | undefined {
  if (!environment || typeof environment !== "object" || !("moduleGraph" in environment)) {
    return;
  }

  const { moduleGraph } = environment as { moduleGraph?: unknown };

  if (
    !moduleGraph ||
    typeof moduleGraph !== "object" ||
    !("getModuleById" in moduleGraph) ||
    !("invalidateModule" in moduleGraph)
  ) {
    return;
  }

  return moduleGraph as ModuleGraphLike;
}

function buildManifestModule(routes: Awaited<ReturnType<typeof discoverRoutes>>) {
  const imports: string[] = [`import { createRouteRecord } from "virtual:nlite/runtime";`];
  const records: string[] = [];

  routes.forEach((route, index) => {
    const pageVar = `pageModule${index}`;
    imports.push(`import * as ${pageVar} from ${JSON.stringify(route.page)};`);

    const treeRecord = route.tree
      .map((segment, segmentIndex) =>
        buildTreeSegmentModule({
          imports,
          routeIndex: index,
          segmentIndex,
          segment,
        }),
      )
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

function buildTreeSegmentModule({
  imports,
  routeIndex,
  segmentIndex,
  segment,
}: {
  imports: string[];
  routeIndex: number;
  segmentIndex: number;
  segment: Awaited<ReturnType<typeof discoverRoutes>>[number]["tree"][number];
}) {
  const entries: string[] = [];

  addTreeConventionImport({
    entries,
    imports,
    exportName: "layout",
    source: segment.layout,
    variableName: `layout${routeIndex}_${segmentIndex}`,
  });
  addTreeConventionImport({
    entries,
    imports,
    exportName: "loading",
    source: segment.loading,
    variableName: `loading${routeIndex}_${segmentIndex}`,
  });
  addTreeConventionImport({
    entries,
    imports,
    exportName: "error",
    source: segment.error,
    variableName: `error${routeIndex}_${segmentIndex}`,
  });
  addTreeConventionImport({
    entries,
    imports,
    exportName: "notFound",
    source: segment.notFound,
    variableName: `notFound${routeIndex}_${segmentIndex}`,
  });

  return `{ ${entries.join(", ")} }`;
}

function addTreeConventionImport({
  entries,
  imports,
  exportName,
  source,
  variableName,
}: {
  entries: string[];
  imports: string[];
  exportName: string;
  source?: string;
  variableName: string;
}) {
  if (!source) {
    return;
  }

  imports.push(`import * as ${variableName} from ${JSON.stringify(source)};`);
  entries.push(`${exportName}: ${variableName}`);
}
