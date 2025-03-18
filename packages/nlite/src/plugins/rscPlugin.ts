import path from "path";
import fs from "fs/promises";
import { Plugin } from "vite";

export default function rscVitePlugin(): Plugin {
  const clientEntryPoints = new Set();
  const clientComponentMap: Record<string, Record<string, any>> = {};

  return {
    name: "vite-plugin-rsc",
    enforce: "pre",

    async resolveId(source, importer) {
      console.log({ source, importer });

      if (!importer || !/\.jsx?$/.test(source)) return null;
      const resolvedPath = path.resolve(path.dirname(importer), source);
      const contents = await fs.readFile(resolvedPath, "utf-8");

      if (contents.startsWith("'use client'")) {
        clientEntryPoints.add(resolvedPath);
        return resolvedPath; // Mark this as a client component
      }
      return null;
    },

    async transform(code, id) {
      if (!clientEntryPoints.has(id)) return null;

      const exportMatches = [
        ...code.matchAll(/export\s+(?:const|function|class)\s+(\w+)/g)
      ];
      let newCode = code;

      for (const match of exportMatches) {
        const exportName = match[1];
        const key = path.relative(process.cwd(), id);

        clientComponentMap[key] = {
          id: `/build/${key.replace(/\\/g, "/")}`,
          name: exportName,
          chunks: [],
          async: true
        };

        newCode += `\n${exportName}.$$id = ${JSON.stringify(key)};`;
        newCode += `\n${exportName}.$$typeof = Symbol.for("react.client.reference");`;
      }

      return {
        code: newCode,
        map: null
      };
    },

    async buildEnd() {
      await fs.writeFile(
        path.resolve(process.cwd(), "build/manifest.json"),
        JSON.stringify(clientComponentMap, null, 2)
      );
    }
  };
}
