import { build as esBuild, Loader } from "esbuild";
import path from "path";
import { readFile, writeFile } from "fs/promises";
import { parse } from "es-module-lexer";

import { getRelativePath } from "../utils/resolveDir";
import { copyNliteStaticFiles } from "../utils";
import { getFileName } from "../utils/readBuild";

const reactComponentRegex = /\.tsx$/;
const cachePath = "./.nlite/.cache/development";
const loader: { [ext: string]: Loader } = {
  ".png": "file",
  ".jpg": "file",
  ".jpeg": "file",
  ".gif": "file",
  ".svg": "file",
  ".mp4": "file",
  ".webm": "file",
  ".css": "css"
};

export const build = async (
  routeList: {
    path: string;
    file: string;
  }[],
  dir: string,
  env = "prod"
) => {
  const entries = routeList
    .filter((entry) => entry.file.trim())
    .map((entry) => `${cachePath}/${entry.file}`);
  const buildPath = path.join(dir, ".nlite");
  const clientEntryPoints = new Set<string>();

  await esBuild({
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
    // publicPath: "/_nlite",
    chunkNames: "server/chunks/[[name]]-[hash]",
    assetNames: "server/media/[[name]]-[hash]",
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
                  return {
                    // Avoid bundling client components into the server build.
                    external: true,
                    // Resolve the client import to the built `.js` file
                    // created by the client `esbuild` process below.
                    path: `/_nlite/${path.basename(
                      relativePath.replace(reactComponentRegex, ".js")
                    )}`
                  };
                }
              }
            }
          );

          build.onEnd((res) => {
            if (res.errors.length) {
              console.error(res.errors[0].text);
              return;
            }

            if (res.metafile) {
              writeFile(
                path.join(buildPath, "server", "_meta_server.json"),
                JSON.stringify(res.metafile)
              );
            }

            res.outputFiles?.forEach((file) => {
              if (file.path.endsWith(".css")) {
                writeFile(
                  path.join(
                    buildPath,
                    "static",
                    "css",
                    file.path.split("/").slice(-1)[0]
                  ),
                  file.text
                );
              } else if (file.path.endsWith(".js")) {
                let text = file.text;
                if (file.text.includes("/_nlite/")) {
                  if (file.path.includes("chunks")) {
                    text = file.text.replaceAll("/_nlite/", "../../static/");
                  } else {
                    text = file.text.replaceAll("/_nlite/", "../static/");
                  }
                }
                writeFile(file.path, text);
              } else {
                writeFile(file.path, file.text);
              }
            });
          });
        }
      }
    ],
    loader: loader
  });

  await esBuild({
    bundle: true,
    // minify: true,
    sourcemap: env == "dev",
    treeShaking: true,
    format: "esm",
    logLevel: "error",
    jsx: "automatic",
    publicPath: "/_nlite",
    entryPoints: [...clientEntryPoints],
    outdir: path.join(buildPath, "static"),
    chunkNames: "chunks/[[name]]-[hash]",
    assetNames: "media/[[name]]-[hash]",
    entryNames: "[[name]]-[hash]",
    splitting: true,
    write: false,
    metafile: true,
    plugins: [
      {
        name: "write-client-imports",
        async setup(build) {
          build.onEnd(async (res) => {
            if (res.errors.length) {
              console.error(res.errors[0].text);
              return;
            }
            if (res.metafile) {
              writeFile(
                path.join(buildPath, "server", "_meta_client.json"),
                JSON.stringify(res.metafile)
              );
            }

            const clientEntries = [...clientEntryPoints];
            for (const file of res.outputFiles!) {
              if (file.path.endsWith(".css")) {
                writeFile(
                  path.join(
                    buildPath,
                    "static",
                    "css",
                    file.path.split("/").slice(-1)[0]
                  ),
                  file.text
                );
                continue;
              }

              let newContents = file.text;
              const fileName = getFileName(file.path);

              if (clientEntries.find((el) => path.parse(el).name == fileName)) {
                const [, exports] = parse(file.text);
                for (const exp of exports) {
                  const key = `/_nlite/${getRelativePath(dir, ".nlite/static", file.path)}#${exp.n}`;
                  newContents += `${exp.ln}.$$id = ${JSON.stringify(key)};\n`;
                  newContents += `${exp.ln}.$$typeof = Symbol.for("react.client.reference");`;
                }
              }

              writeFile(file.path, newContents);
            }
            await copyNliteStaticFiles();
          });
        }
      }
    ],
    loader
  });
};
