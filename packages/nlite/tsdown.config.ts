import { defineConfig, type UserConfig } from "tsdown";

export default defineConfig((_opt): UserConfig[] => [
  {
    entry: {
      index: "./src/index.ts",
      "lib/link": "./src/lib/link.tsx",
      "lib/navigation": "./src/lib/navigation/index.ts",
      "lib/headers": "./src/lib/headers.ts",
      "lib/worker/*": "./src/lib/worker/*.ts",
      "lib/mdx": "./src/lib/mdx/index.ts",
      config: "./src/config.ts",
      "internal/default-config": "./src/internal/default-config.ts",
      "internal/prerender-worker": "./src/internal/prerender-worker.ts",
      runtime: "./src/runtime.tsx",
      "api.runtime": "./src/api.runtime.ts",
      "lib/errorBoundary": "./src/lib/errorBoundary.tsx",
      "lib/not-found-boundary": "./src/lib/not-found-boundary.tsx",
      "lib/redirect-boundary": "./src/lib/redirect-boundary.tsx",
      "modules/*": "./src/modules/*.ts",
      adapters: "./src/adapters/index.ts",
    },
    dts: true,
    deps: {
      neverBundle: ["virtual:nlite/routes", "virtual:nlite/api", "virtual:nlite/content", "nlite"],
    },
    format: "esm",
    outDir: "dist",
    clean: true,
    sourcemap: _opt.watch ? true : false,
  },
  {
    entry: {
      nlite: "./src/bin/nlite.ts",
    },
    platform: "node",
    format: "esm",
    outDir: "bin",
    dts: false,
    sourcemap: false,
    clean: true,
    outExtensions: () => ({
      js: ".js",
    }),
  },
]);
