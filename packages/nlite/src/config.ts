import {
  createLogger,
  defineConfig as defineViteConfig,
  mergeConfig,
  type ConfigEnv,
  type UserConfig,
  type UserConfigExport,
} from "vite";

import { nlite } from "./plugins/index.js";
import type { NliteOptions } from "./types.js";

export interface NliteUserConfig extends UserConfig {
  nlite?: NliteOptions;
}

export function defineConfig(config: NliteUserConfig) {
  return defineViteConfig(async (env) => {
    const resolved = await resolveConfig(config, env);
    return withNlitePlugin(resolved);
  });
}

export { mergeConfig };

async function resolveConfig(config: UserConfigExport, env: ConfigEnv) {
  if (typeof config === "function") {
    return (await config(env)) as NliteUserConfig;
  }

  return (await config) as NliteUserConfig;
}

const customLogger = createLogger("info", { prefix: "[NLITE]" });

function withNlitePlugin(config: NliteUserConfig) {
  const { nlite: nliteOptions, plugins = [], ...rest } = config;

  return mergeConfig(rest, {
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
    plugins: [...plugins, ...nlite(nliteOptions)],
  });
}
