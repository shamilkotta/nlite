import {
  createLogger,
  defineConfig as defineViteConfig,
  mergeConfig,
  type ConfigEnv,
  type UserConfig,
  type UserConfigExport,
} from "vite";

import { nlite } from "./plugin.js";
import type { NliteOptions } from "./types.js";

export interface NliteUserConfig extends UserConfig {
  nlite?: NliteOptions;
}

export function defineConfig(config: UserConfigExport) {
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
    customLogger,
    plugins: [...nlite(nliteOptions), ...plugins],
  });
}
