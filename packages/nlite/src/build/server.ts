import { build as esBuild } from "esbuild";
import path from "path";
import { readFile, writeFile } from "fs/promises";
import { nanoid } from "nanoid";

import { loader } from ".";

const reactComponentRegex = /\.tsx$/;
const cachePath = "./.nlite/.cache/development";

export const serverBuild = async (
  routeList: {
    path: string;
    file: string;
  }[],
  buildPath: string,
  dir: string,
  env = "prod",
  clientExports: Map<string, string>
) => {
  const entries = routeList
    .filter((entry) => entry.file.trim())
    .map((entry) => path.join(dir, cachePath, entry.file));
  const clientEntryPoints = new Set<string>();

  const buildOutputs = await esBuild({
    bundle: true,
    jsx: "automatic",
    minify: true,
    sourcemap: env == "dev",
    splitting: true,
    treeShaking: true,
    format: "esm",
    logLevel: "debug",
    entryPoints: [...entries],
    outdir: buildPath,
    chunkNames: "server/chunks/[[name]]-[hash]",
    assetNames: "static/media/[name]-[hash]",
    entryNames: "server/[[name]]-[hash]",
    packages: "external",
    metafile: true,
    write: false,
    plugins: [
      {
        name: "resolve-client-imports",
        async setup(build) {
          // Intercept component imports to check for 'use client'
          build.onResolve(
            {
              filter: /^(\.\/|\.\.\/)/,
              namespace: "file"
            },
            async ({ path: relativePath, resolveDir }) => {
              if (
                (path.extname(relativePath) === ".tsx" ||
                  !path.extname(relativePath)) &&
                !relativePath.includes(".nlite")
              ) {
                if (!path.extname(relativePath))
                  relativePath = `${relativePath}.tsx`;
                const clientPath = path.join(resolveDir, relativePath);
                const contents = await readFile(clientPath, "utf-8");

                if (
                  contents.startsWith("'use client'") ||
                  contents.startsWith('"use client"')
                ) {
                  clientEntryPoints.add(clientPath);
                  const id = nanoid(6);
                  const serverRef = `/_nlite/${id}-${path.basename(
                    relativePath.replace(reactComponentRegex, ".js")
                  )}`;
                  clientExports.set(serverRef, clientPath);
                  return {
                    // Avoid bundling client components into the server build.
                    external: true,
                    // Resolve the client import to the built `.js` file
                    // created by the client `esbuild` process below.
                    path: serverRef
                  };
                }
              }
            }
          );

          build.onEnd((res) => {
            if (res.errors.length) {
              console.error(res.errors[0].text);
              process.exit(1);
            }

            if (res.metafile) {
              writeFile(
                path.join(buildPath, "server", "_meta_server.json"),
                JSON.stringify(res.metafile)
              );
            }
          });
        }
      }
    ],
    loader: loader
  });
  return { serverOutputs: buildOutputs, clientEntryPoints };
};
