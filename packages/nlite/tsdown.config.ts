import { defineConfig } from "tsdown";

export default defineConfig([
  {
    entry: {
      index: "./src/index.ts",
      link: "./src/lib/link.tsx",
      navigation: "./src/lib/navigation.tsx",
      runtime: "./src/runtime.tsx",
      ErrorBoundary: "./src/lib/ErrorBoundary.tsx",
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
