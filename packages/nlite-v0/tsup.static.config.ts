import { defineConfig } from "tsup";

import { jsExtensionRes } from "./plugins/jsExtensionRes";
import { folderImportRes } from "./plugins/folderImportRes";

export default defineConfig((options) => ({
  entry: ["src/static/**/*"],
  dts: false,
  tsconfig: "./tsconfig.json",
  treeshake: true,
  format: ["esm"],
  clean: true,
  minify: false,
  sourcemap: options.watch ? true : false,
  bundle: false,
  outDir: "dist/static",
  esbuildPlugins: [folderImportRes(), jsExtensionRes()],
  keepNames: true
}));
