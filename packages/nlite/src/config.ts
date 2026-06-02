import {
  createLogger,
  defineConfig as defineViteConfig,
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

const customLogger = createLogger("info", { prefix: "[NLITE]" });

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
    environments: {
      client: {
        build: {
          outDir: ".nlite/client",
        },
      },
      ssr: {
        build: {
          outDir: ".nlite/server/ssr",
        },
      },
      rsc: {
        build: {
          outDir: ".nlite/server",
        },
      },
    },
    plugins: [...topLevelPlugins, ...vitePlugins, ...nlite(nliteOptions)],
  });
}
