import { defineConfig, type UserConfig } from "tsdown";

export default defineConfig((_opt): UserConfig[] => [
  {
    entry: {
      index: "./src/index.ts",
      "lib/link": "./src/lib/link.tsx",
      "lib/navigation": "./src/lib/navigation.tsx",
      runtime: "./src/runtime.tsx",
      "lib/errorBoundary": "./src/lib/errorBoundary.tsx",
      "modules/entry.rsc": "./src/modules/entry.rsc.ts",
      "modules/entry.ssr": "./src/modules/entry.ssr.ts",
      "modules/entry.browser": "./src/modules/entry.browser.ts",
    },
    dts: true,
    deps: {
      neverBundle: ["virtual:nlite/routes", "nlite"],
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
