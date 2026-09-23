import { fileURLToPath } from "node:url";
import path from "node:path";
import type { PluginOption, ResolvedConfig } from "vite";

export interface CloudflareAdapterOptions {}

export async function cloudflare(_options: CloudflareAdapterOptions = {}): Promise<PluginOption[]> {
  const { cloudflare: cloudflarePlugin } = await import("@cloudflare/vite-plugin");

  const distRoot = path.dirname(fileURLToPath(import.meta.url));
  const rscEntryPath = path.join(distRoot, "modules", "entry.rsc");
  let config: ResolvedConfig;

  return [
    {
      name: "nlite:cloudflare",
      configResolved(resolvedConfig) {
        config = resolvedConfig;
      },
    },
    ...cloudflarePlugin({
      viteEnvironment: {
        name: "rsc",
        childEnvironments: ["ssr", "api"],
      },
      config(wranglerConfig) {
        console.log({ config });
        const defaults: Record<string, unknown> = {
          main: rscEntryPath,
          compatibility_date: wranglerConfig.compatibility_date,
          workers_dev: wranglerConfig.workers_dev ?? true,
          assets: {
            ...wranglerConfig.assets,
            not_found_handling: "none",
            html_handling: "drop-trailing-slash",
          },
        };

        if (!wranglerConfig.compatibility_flags?.includes("nodejs_compat")) {
          defaults.compatibility_flags = ["nodejs_compat"];
        }

        return defaults;
      },
    }),
  ];
}

// New Cloudflare adapter implementation

// export const NLITE_CLOUDFLARE_ADAPTER = "nlite:cloudflare-adapter";

// const ORIGIN_BINDING = "ORIGIN";
// const ASSETS_BINDING = "ASSETS";
// const WRANGLER_EXTENSIONS = ["jsonc", "json", "toml"] as const;

// type CloudflareAdapterPlugin = Plugin & {
//   [NLITE_CLOUDFLARE_ADAPTER]: CloudflareAdapterOptions;
// };

// /**
//  * Registers the Cloudflare adapter. Dual-worker (eyeball + Smart Placement origin) is used
//  * automatically when `ppr: true` is set in `defineConfig`; otherwise a single Worker is built.
//  *
//  * Wrangler merge (handled by `@cloudflare/vite-plugin` via `defu(overrides, fileConfig)`):
//  * - No PPR: your `wrangler.json(c)` is the entry Worker config.
//  * - PPR: your wrangler file is the **origin** auxiliary Worker config (bindings land next to
//  *   app code). The eyeball entry uses a stub config because the plugin forbids loading the
//  *   same `configPath` twice.
//  */
// export function cloudflare(options: CloudflareAdapterOptions = {}): PluginOption {
//   const plugin = {
//     name: NLITE_CLOUDFLARE_ADAPTER,
//     [NLITE_CLOUDFLARE_ADAPTER]: options,
//   } satisfies CloudflareAdapterPlugin;

//   return plugin;
// }

// export function isCloudflareAdapterPlugin(plugin: PluginOption): plugin is CloudflareAdapterPlugin {
//   return (
//     !!plugin &&
//     typeof plugin === "object" &&
//     !Array.isArray(plugin) &&
//     !(plugin instanceof Promise) &&
//     "name" in plugin &&
//     plugin.name === NLITE_CLOUDFLARE_ADAPTER &&
//     NLITE_CLOUDFLARE_ADAPTER in plugin
//   );
// }

// /** Expand the adapter marker into real Vite plugins once `nlite` options are known. */
// export async function resolveCloudflarePlugins(
//   nliteOptions: NliteOptions,
//   adapterOptions: CloudflareAdapterOptions = {},
// ): Promise<PluginOption[]> {
//   const { cloudflare: cloudflarePlugin } = await import("@cloudflare/vite-plugin");

//   const distRoot = path.dirname(fileURLToPath(import.meta.url));
//   const rscEntryPath = path.join(distRoot, "modules", "entry.rsc");
//   const eyeballEntryPath = path.join(distRoot, "modules", "entry.eyeball");
//   const eyeballStubPath = path.join(distRoot, "assets", "wrangler.eyeball.json");
//   const placement = adapterOptions.placement ?? { mode: "smart" as const };
//   const root = process.cwd();
//   const userWranglerPath = findUserWranglerConfig(root);

//   if (!nliteOptions.ppr) {
//     return cloudflarePlugin({
//       ...(userWranglerPath ? { configPath: userWranglerPath } : {}),
//       viteEnvironment: {
//         name: "rsc",
//         childEnvironments: ["ssr", "api"],
//       },
//       config(wranglerConfig) {
//         return singleWorkerDefaults(wranglerConfig, rscEntryPath);
//       },
//     });
//   }

//   if (!userWranglerPath) {
//     throw new Error(
//       "[nlite] PPR on Cloudflare requires a wrangler.json, wrangler.jsonc, or wrangler.toml in the project root.",
//     );
//   }

//   // Public Worker keeps the user's wrangler `name`; origin is `${name}-origin`.
//   const publicWorkerName = readWranglerName(userWranglerPath) ?? "nlite";
//   const originServiceName = `${publicWorkerName}-origin`;

//   const environmentPlugin: Plugin = {
//     name: "nlite:cloudflare-environments",
//     config() {
//       return {
//         environments: {
//           eyeball: {
//             build: {
//               outDir: ".nlite/server/eyeball",
//             },
//           },
//         },
//       };
//     },
//   };

//   return [
//     environmentPlugin,
//     ...cloudflarePlugin({
//       // Stub only — user wrangler cannot be entry + auxiliary (duplicate configPath).
//       configPath: eyeballStubPath,
//       viteEnvironment: {
//         name: "eyeball",
//       },
//       config() {
//         return {
//           name: publicWorkerName,
//           main: eyeballEntryPath,
//           workers_dev: true,
//           compatibility_flags: ["nodejs_compat"],
//           assets: {
//             binding: ASSETS_BINDING,
//             not_found_handling: "none",
//             html_handling: "drop-trailing-slash",
//             run_worker_first: true,
//           },
//           services: [
//             {
//               binding: ORIGIN_BINDING,
//               service: originServiceName,
//             },
//           ],
//         };
//       },
//       auxiliaryWorkers: [
//         {
//           // User wrangler merges onto the Smart Placement origin.
//           configPath: userWranglerPath,
//           viteEnvironment: {
//             name: "rsc",
//             childEnvironments: ["ssr", "api"],
//           },
//           config(wranglerConfig) {
//             const defaults: Record<string, unknown> = {
//               name: originServiceName,
//               main: rscEntryPath,
//               placement,
//             };

//             if (!wranglerConfig.compatibility_flags?.includes("nodejs_compat")) {
//               defaults.compatibility_flags = ["nodejs_compat"];
//             }

//             return defaults;
//           },
//         },
//       ],
//     }),
//   ];
// }

// function findUserWranglerConfig(root: string) {
//   for (const extension of WRANGLER_EXTENSIONS) {
//     const configPath = path.join(root, `wrangler.${extension}`);
//     if (existsSync(configPath)) {
//       return configPath;
//     }
//   }
// }

// function readWranglerName(configPath: string) {
//   const text = readFileSync(configPath, "utf8");

//   if (configPath.endsWith(".toml")) {
//     const match = text.match(/^\s*name\s*=\s*["']([^"']+)["']/m);
//     return match?.[1];
//   }

//   try {
//     const json = text
//       .replace(/\/\*[\s\S]*?\*\//g, "")
//       .replace(/^\s*\/\/.*$/gm, "")
//       .replace(/,(\s*[}\]])/g, "$1");
//     return (JSON.parse(json) as { name?: string }).name;
//   } catch {
//     return;
//   }
// }

// function singleWorkerDefaults(
//   wranglerConfig: {
//     compatibility_date?: string;
//     workers_dev?: boolean;
//     compatibility_flags?: string[];
//     assets?: Record<string, unknown>;
//   },
//   rscEntryPath: string,
// ) {
//   const defaults: Record<string, unknown> = {
//     main: rscEntryPath,
//     compatibility_date: wranglerConfig.compatibility_date,
//     workers_dev: wranglerConfig.workers_dev ?? true,
//     assets: {
//       ...wranglerConfig.assets,
//       not_found_handling: "none",
//       html_handling: "drop-trailing-slash",
//     },
//   };

//   if (!wranglerConfig.compatibility_flags?.includes("nodejs_compat")) {
//     defaults.compatibility_flags = ["nodejs_compat"];
//   }

//   return defaults;
// }
