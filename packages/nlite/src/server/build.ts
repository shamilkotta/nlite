import { build } from "vite";

export default async function buildServer() {
  await build({
    root: "./",
    build: {
      outDir: "./.nlite/static/chunks",
      minify: true,
      sourcemap: true,
      rollupOptions: {
        input: "./src/server/_entry_hydrate.ts",
        output: {
          format: "es",
          entryFileNames: "_entry.js"
        }
      }
    }
  });
}
