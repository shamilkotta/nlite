import { defineConfig } from "tsup";

import { jsExtensionRes } from "./plugins/jsExtensionRes";
import { folderImportRes } from "./plugins/folderImportRes";

export default defineConfig((options) => ({
  entry: [
    "src/**/*.{js,jsx,ts,tsx}",
    "!src/index.html",
    "!src/**/*.d.{ts,tsx}",
    "!src/static/**/*"
  ],
  dts: true,
  watch: options.watch,
  tsconfig: "./tsconfig.json",
  treeshake: true,
  format: ["esm"],
  clean: true,
  minify: false,
  sourcemap: options.watch ? true : false,
  bundle: false,
  esbuildPlugins: [folderImportRes(), jsExtensionRes()],
  esbuildOptions(options) {
    options.outbase = "src";
  },
  keepNames: true,
  ignoreWatch: ["**/*.d.ts", "node_modules", "dist"],
  onSuccess: "pnpm run build:static"
}));
