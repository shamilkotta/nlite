import { build as esBuild } from "esbuild";
import path from "path";
import { writeFile } from "fs/promises";

import { loader } from ".";

export const clientBuild = async (
  clientEntryPoints: Set<string>,
  buildPath: string
) => {
  const buildOutputs = await esBuild({
    bundle: true,
    define: {
      "process.env.NODE_ENV": `'${process.env.NODE_ENV || "development"}'`
    },
    treeShaking: true,
    format: "esm",
    logLevel: "silent",
    jsx: "automatic",
    // publicPath: "/_nlite",
    entryPoints: [...clientEntryPoints],
    outdir: path.join(buildPath, "static"),
    chunkNames: "chunks/[[name]]-[hash]",
    assetNames: "media/[name]-[hash]",
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
          });
        }
      }
    ],
    loader
  });

  return { clientOutpus: buildOutputs };
};
