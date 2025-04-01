import { BuildContext, context as esBuild, Loader } from "esbuild";
import path from "path";
import { readFile, writeFile } from "fs/promises";
import { parse } from "es-module-lexer";

import { getRelativePath } from "../utils/resolveDir";
import { Route } from "..";
// import { generateEntries } from "./processRoutes";

const reactComponentRegex = /\.tsx$/;
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

export const build = async (_: Route[], dir: string, env = "dev") => {
  // const entries = generateEntries(routeList);
  const buildPath = path.join(dir, ".nlite");
  let clientCtx: BuildContext;
  const clientEntryPoints = new Set<string>();
  const clientComponentMap: Record<string, any> = {};

  const serverCtx = await esBuild({
    bundle: true,
    jsx: "automatic",
    minify: true,
    sourcemap: env == "dev",
    splitting: true,
    treeShaking: true,
    format: "esm",
    logLevel: "debug",
    entryPoints: [...[]],
    outdir: buildPath,
    publicPath: "/_nlite",
    chunkNames: "server/chunks/[name]-[hash]",
    assetNames: "static/media/[name]-[hash]",
    entryNames: "server/[name]-[hash]",
    packages: "external",
    metafile: true,
    write: false,
    plugins: [
      {
        name: "resolve-client-imports",
        async setup(build) {
          build.onStart(() => {
            console.log("compiling....");
            clientCtx?.dispose();
          });

          // Intercept component imports to check for 'use client'
          build.onResolve(
            { filter: /^(.*\/)?([^/.]+)(\.(ts|js|jsx|tsx))?$/ },
            async ({ path: relativePath }) => {
              const clientPath = path.join(dir, relativePath);
              const contents = await readFile(clientPath, "utf-8");

              if (
                contents.startsWith("'use client'") ||
                contents.startsWith('"use client"')
              ) {
                clientEntryPoints.add(clientPath);
                console.log({
                  id: relativePath.replace(reactComponentRegex, "$1$2.js")
                });

                return {
                  // Avoid bundling client components into the server build.
                  external: true,
                  // Resolve the client import to the built `.js` file
                  // created by the client `esbuild` process below.
                  path: relativePath.replace(reactComponentRegex, "$1$2.js")
                };
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
                JSON.stringify(JSON.stringify(res.metafile)),
                {}
              );
            }

            res.outputFiles?.forEach((file) => {
              if (file.path.endsWith(".css")) {
                writeFile(
                  path.join(
                    buildPath,
                    "static",
                    "chunks",
                    file.path.split("/").slice(-1)[0]
                  ),
                  file.text
                );
              } else {
                writeFile(file.path, file.text);
              }
            });

            esBuild({
              bundle: true,
              minify: true,
              sourcemap: env == "dev",
              treeShaking: true,
              format: "esm",
              logLevel: "error",
              jsx: "automatic",
              publicPath: "/_nlite",
              entryPoints: [...clientEntryPoints],
              outdir: path.join(buildPath, "static"),
              chunkNames: "chunks/[name]-[hash]",
              assetNames: "media/[name]-[hash]",
              splitting: true,
              write: false,
              metafile: true,
              plugins: [
                {
                  name: "resolve-client-imports",
                  setup(build) {
                    build.onEnd((res) => {
                      if (res.errors.length) {
                        console.error(res.errors[0].text);
                        return;
                      }
                      if (res.metafile) {
                        writeFile(
                          path.join(buildPath, "server", "_meta_client.json"),
                          JSON.stringify(JSON.stringify(res.metafile))
                        );
                      }

                      res.outputFiles?.forEach(async (file) => {
                        // Parse file export names
                        const [, exports] = parse(file.text);
                        let newContents = file.text;

                        for (const exp of exports) {
                          // Create a unique lookup key for each exported component.
                          // Could be any identifier!
                          // We'll choose the file path + export name for simplicity.
                          const key = file.path;
                          console.log({ key });
                          console.log({
                            path: `/.nlite/${getRelativePath(dir, ".nlite", file.path)}`
                          });

                          clientComponentMap[key] = {
                            // Have the browser import your component from your server
                            // at `/build/[component].js`
                            id: `/.nlite/${getRelativePath(dir, ".nlite", file.path)}`,
                            // Use the detected export name
                            name: exp.n,
                            // Turn off chunks. This is webpack-specific
                            chunks: [],
                            // Use an async import for the built resource in the browser
                            async: true
                          };

                          // Tag each component export with a special `react.client.reference` type
                          // and the map key to look up import information.
                          // This tells your stream renderer to avoid rendering the
                          // client component server-side. Instead, import the built component
                          // client-side at `clientComponentMap[key].id`
                          newContents += `
                              ${exp.ln}.$$id = ${JSON.stringify(key)};
                              ${exp.ln}.$$typeof = Symbol.for("react.client.reference");
                          `;
                        }
                        await writeFile(file.path, newContents);
                      });
                      console.log("client compiled");

                      // HMR
                    });
                  }
                }
              ],
              loader
            }).then((ctx) => {
              clientCtx = ctx;
              clientCtx.watch();
            });
          });
        }
      }
    ],
    loader: loader
  });
  await serverCtx.watch();
  return serverCtx;
};
