import path from "node:path";
import { fileURLToPath } from "node:url";

import type { ModuleNode, Plugin, PluginOption, ViteDevServer } from "vite";

import { discoverApiRoutes } from "../utils/fs-routes.js";
import type { NliteOptions } from "../types.js";

const VIRTUAL_API_MANIFEST_ID = "virtual:nlite/api";
const VIRTUAL_API_RUNTIME_ID = "virtual:nlite/runtime/api";
const RESOLVED_API_MANIFEST_ID = `\0${VIRTUAL_API_MANIFEST_ID}`;

interface ModuleGraphLike {
  getModuleById(id: string): ModuleNode | undefined;
  invalidateModule(mod: ModuleNode): void;
}

export function api(options: NliteOptions = {}): PluginOption[] {
  const appDir = options.appDir ?? "app";
  let projectRoot = process.cwd();

  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const apiRuntimeId = path.join(__dirname, "api.runtime.mjs");

  const environmentPlugin: Plugin = {
    name: "nlite:api-environment",
    config() {
      return {
        environments: {
          api: {
            build: {
              outDir: ".nlite/server/api",
              copyPublicDir: false,
              rollupOptions: {
                input: {
                  index: VIRTUAL_API_MANIFEST_ID,
                },
              },
            },
            resolve: {
              noExternal: true,
            },
          },
        },
      };
    },
  };

  const buildPlugin: Plugin = {
    name: "nlite:api-build",
    enforce: "post",
    buildApp: {
      async handler(builder) {
        const apiEnvironment = builder.environments.api;
        if (!apiEnvironment) {
          return;
        }

        await builder.build(apiEnvironment);
      },
    },
  };

  const apiPlugin: Plugin = {
    name: "nlite:api",
    applyToEnvironment(environment) {
      return environment.name === "api";
    },
    configResolved(config) {
      projectRoot = config.root;
    },
    configureServer(server) {
      const appRoot = path.resolve(server.config.root, appDir);

      server.watcher.add(appRoot);
      server.watcher.on("add", (file) => invalidateApiRoutes(server, appRoot, file));
      server.watcher.on("unlink", (file) => invalidateApiRoutes(server, appRoot, file));
    },
    resolveId(id) {
      if (id === RESOLVED_API_MANIFEST_ID || id === apiRuntimeId) {
        return id;
      }

      if (id === VIRTUAL_API_MANIFEST_ID) {
        return RESOLVED_API_MANIFEST_ID;
      }

      if (id === VIRTUAL_API_RUNTIME_ID) {
        return apiRuntimeId;
      }

      return;
    },
    async load(id) {
      if (id === RESOLVED_API_MANIFEST_ID) {
        const apiRoutes = await discoverApiRoutes(projectRoot, appDir);
        return buildApiManifestModule(apiRoutes);
      }

      return;
    },
  };

  return [environmentPlugin, buildPlugin, apiPlugin];
}

function invalidateApiRoutes(server: ViteDevServer, appRoot: string, file: string) {
  const relative = path.relative(appRoot, file);
  const isWithinAppRoot =
    relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));

  if (!isWithinAppRoot || !isRouteConventionFile(file)) {
    return;
  }

  invalidateApiManifest(server.moduleGraph);

  const apiEnvironment = server.environments.api;
  if (apiEnvironment && "moduleGraph" in apiEnvironment) {
    invalidateApiManifest(apiEnvironment.moduleGraph as unknown as ModuleGraphLike);
  }
}

function isRouteConventionFile(file: string) {
  const extension = path.extname(file).slice(1);

  if (!["ts", "js"].includes(extension)) {
    return false;
  }

  return path.basename(file, path.extname(file)) === "route";
}

function invalidateApiManifest(moduleGraph: ModuleGraphLike) {
  const manifestModule = moduleGraph.getModuleById(RESOLVED_API_MANIFEST_ID);

  if (manifestModule) {
    moduleGraph.invalidateModule(manifestModule);
  }
}

function buildApiManifestModule(apiRoutes: Awaited<ReturnType<typeof discoverApiRoutes>>) {
  if (apiRoutes.length === 0) {
    return `export const apiRoutes = [];

export function couldMatchApi(_pathname) {
  return false;
}

export const apiHandler = null;
`;
  }

  const imports = [
    `import { createApiApp, createApiMatcher, createApiRouteRecord } from "virtual:nlite/runtime/api";`,
  ];
  const records: string[] = [];

  apiRoutes.forEach((route, index) => {
    const routeVar = `apiRouteModule${index}`;
    imports.push(`import * as ${routeVar} from ${JSON.stringify(route.routeFile)};`);
    records.push(`createApiRouteRecord({
  id: ${JSON.stringify(route.id)},
  routePath: ${JSON.stringify(route.routePath)},
  sourceFile: ${JSON.stringify(route.routeFile)},
  module: ${routeVar},
})`);
  });

  return `${imports.join("\n")}

const apiRoutes = [
  ${records.join(",\n  ")}
];

export { apiRoutes };

export const couldMatchApi = createApiMatcher(apiRoutes);

const apiApp = createApiApp(apiRoutes);

export const apiHandler = (request) => apiApp.fetch(request);
`;
}
