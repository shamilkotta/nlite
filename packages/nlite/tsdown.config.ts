import { defineConfig } from "tsdown";

export default defineConfig([
  {
    entry: {
      index: "./src/index.ts",
      link: "./src/link.tsx",
      navigation: "./src/navigation.tsx",
      runtime: "./src/runtime.tsx",
    },
    dts: true,
    format: "esm",
    outDir: "dist",
    clean: true,
    sourcemap: true,
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
