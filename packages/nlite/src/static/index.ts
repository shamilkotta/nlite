import { build } from "esbuild";
import fs from "fs/promises";

const entries = await fs.readdir("./src/static");

build({
  entryPoints: entries
    .filter((el) => el !== "index.ts")
    .map((entry) => `./src/static/${entry}`),
  bundle: true,
  minify: true,
  format: "esm",
  logLevel: "error",
  jsx: "automatic",
  outdir: "./dist/static",
  external: ["express", "sirv"]
});
