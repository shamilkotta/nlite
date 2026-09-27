import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import path from "node:path";
import type { PluginConfig, WorkerConfig } from "@cloudflare/vite-plugin";
import type { PluginOption, UserConfig } from "vite";

import type { NliteOptions } from "../../types.js";

export interface CloudflareAdapterOptions {
  placement?: { mode: "smart" };
}

const ORIGIN_BINDING = "ORIGIN";
const ASSETS_BINDING = "ASSETS";
const WRANGLER_EXTENSIONS = ["jsonc", "json", "toml"] as const;

export async function cloudflare(options: CloudflareAdapterOptions = {}): Promise<PluginOption[]> {
  const { cloudflare: cloudflarePlugin } = await import("@cloudflare/vite-plugin");

  const distRoot = path.dirname(fileURLToPath(import.meta.url));
  const rscEntryPath = path.join(distRoot, "modules", "entry.rsc");
  const eyeballEntryPath = path.join(distRoot, "adapters", "cloudflare", "entry.eyeball");
  const placement = options.placement ?? { mode: "smart" as const };

  const pluginConfig: PluginConfig = {
    viteEnvironment: {
      name: "rsc",
      childEnvironments: ["ssr", "api"],
    },
    config(wranglerConfig) {
      return singleWorkerDefaults(wranglerConfig, rscEntryPath);
    },
  };

  return [
    {
      name: "nlite:cloudflare",
      enforce: "pre",
      config(userConfig) {
        const ppr = (userConfig as UserConfig & { nlite?: NliteOptions }).nlite?.ppr;
        if (!ppr) return;

        const root = userConfig.root ? path.resolve(userConfig.root) : process.cwd();
        const userWranglerPath = findUserWranglerConfig(root);
        if (!userWranglerPath) {
          throw new Error(
            "[nlite] PPR on Cloudflare requires a wrangler.json, wrangler.jsonc, or wrangler.toml in the project root.",
          );
        }

        const publicWorkerName = readWranglerConfig(userWranglerPath)?.name ?? "nlite";
        const originServiceName = `${publicWorkerName}-origin`;

        pluginConfig.configPath = writeEyeballStub(userWranglerPath);
        pluginConfig.viteEnvironment = { name: "eyeball" };
        pluginConfig.config = () => ({
          name: publicWorkerName,
          main: eyeballEntryPath,
          workers_dev: true,
          assets: {
            binding: ASSETS_BINDING,
            not_found_handling: "none",
            html_handling: "drop-trailing-slash",
            run_worker_first: true,
          },
          services: [
            {
              binding: ORIGIN_BINDING,
              service: originServiceName,
            },
          ],
        });

        pluginConfig.auxiliaryWorkers = [
          {
            configPath: userWranglerPath,
            viteEnvironment: {
              name: "rsc",
              childEnvironments: ["ssr", "api"],
            },
            config(wranglerConfig) {
              const defaults: Record<string, unknown> = {
                name: originServiceName,
                main: rscEntryPath,
                placement,
                workers_dev: false,
                preview_urls: false,
                routes: [],
              };

              if (!wranglerConfig.compatibility_flags?.includes("nodejs_compat")) {
                defaults.compatibility_flags = ["nodejs_compat"];
              }

              return defaults;
            },
          },
        ];

        return {
          environments: {
            eyeball: {
              build: {
                outDir: ".nlite/eyeball",
              },
            },
          },
        };
      },
    },
    ...cloudflarePlugin(pluginConfig),
  ];
}

function writeEyeballStub(userWranglerPath: string) {
  const dir = mkdtempSync(path.join(tmpdir(), "nlite-eyeball-"));
  const stubPath = path.join(dir, "wrangler.json");
  writeFileSync(
    stubPath,
    JSON.stringify({
      compatibility_date: readWranglerConfig(userWranglerPath)?.compatibility_date,
    }),
  );
  return stubPath;
}

function findUserWranglerConfig(root: string) {
  for (const extension of WRANGLER_EXTENSIONS) {
    const configPath = path.join(root, `wrangler.${extension}`);
    if (existsSync(configPath)) {
      return configPath;
    }
  }
}

function readWranglerConfig(configPath: string) {
  const text = readFileSync(configPath, "utf8");

  if (configPath.endsWith(".toml")) {
    const match = text.match(/^\s*name\s*=\s*["']([^"']+)["']/m);
    return match?.[1];
  }

  try {
    const json = text
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "")
      .replace(/,(\s*[}\]])/g, "$1");
    return JSON.parse(json);
  } catch {
    return;
  }
}

function singleWorkerDefaults(wranglerConfig: WorkerConfig, rscEntryPath: string) {
  const defaults: Partial<WorkerConfig> = {
    main: rscEntryPath,
    compatibility_date: wranglerConfig.compatibility_date,
    workers_dev: wranglerConfig.workers_dev ?? true,
    assets: {
      ...wranglerConfig.assets,
      binding: ASSETS_BINDING,
      not_found_handling: "none",
      html_handling: "drop-trailing-slash",
    },
  };

  if (!wranglerConfig.compatibility_flags?.includes("nodejs_compat")) {
    defaults.compatibility_flags = ["nodejs_compat"];
  }

  return defaults;
}
