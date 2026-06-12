import {
  createLogger,
  defineConfig as defineViteConfig,
  loadEnv,
  mergeConfig,
  type ConfigEnv,
  type UserConfig,
} from "vite";

import { nlite } from "./plugins/index.js";
import type { NliteOptions } from "./types.js";

export interface NliteUserConfig extends NliteOptions {
  plugins?: UserConfig["plugins"];
  vite?: UserConfig;
}

type NliteUserConfigExport =
  | NliteUserConfig
  | Promise<NliteUserConfig>
  | ((env: ConfigEnv) => NliteUserConfig | Promise<NliteUserConfig>);

export function defineConfig(config: NliteUserConfigExport) {
  return defineViteConfig(async (env) => {
    Object.assign(process.env, loadEnv(env.mode, process.cwd(), ""));
    const resolved = await resolveConfig(config, env);
    return withNlitePlugin(resolved);
  });
}

export { mergeConfig };

async function resolveConfig(config: NliteUserConfigExport, env: ConfigEnv) {
  if (typeof config === "function") {
    return await config(env);
  }

  return await config;
}

const customLogger = createLogger("info", { prefix: "[nlite]" });

function withNlitePlugin(config: NliteUserConfig) {
  const { vite, plugins: topLevelPlugins = [], ...nliteOptions } = config;
  const { plugins: vitePlugins = [], ...viteConfig } = vite ?? {};

  return mergeConfig(viteConfig, {
    nlite: nliteOptions,
    customLogger,
    build: {
      outDir: ".nlite",
      emptyOutDir: true,
    },
    envPrefix: ["NLITE_PUBLIC_"],
    environments: {
      client: {
        build: {
          outDir: ".nlite/client",
          rolldownOptions: {
            output: {
              chunkFileNames: "_nlite/chunks/[hash].js",
              entryFileNames: "_nlite/chunks/[hash].js",
              assetFileNames: "_nlite/assets/[hash][extname]",
            },
          },
        },
      },
      ssr: {
        build: {
          outDir: ".nlite/server/ssr",
          rolldownOptions: {
            output: {
              chunkFileNames: "chunks/[hash].js",
            },
          },
        },
      },
      rsc: {
        build: {
          outDir: ".nlite/server",
          rolldownOptions: {
            output: {
              chunkFileNames: "_nlite/chunks/[hash].js",
              assetFileNames: "_nlite/assets/[hash][extname]",
            },
          },
        },
      },
    },
    plugins: [...topLevelPlugins, ...vitePlugins, ...nlite(nliteOptions)],
  });
}
