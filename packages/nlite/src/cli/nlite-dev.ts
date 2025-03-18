import express from "express";
import path from "path";
import { promises } from "fs";
import sirv from "sirv";
import chokidar from "chokidar";
import { BuildContext } from "esbuild";
import { tsImport } from "tsx/esm/api";

import { fileExists, FileType, getProjectDir } from "../utils/resolveDir";
import { printAndExit } from "../utils";
// import { controller } from "../server/dev";
import { build } from "../server/build.dev";

type DevServerOptions = {
  hostname?: string;
  "experimental-https"?: string;
};

export const startServer = async (
  _: DevServerOptions,
  port: number,
  directory?: string
) => {
  const dir = getProjectDir(directory);

  const routePath = path.join(dir, "routes.ts");
  if (!(await fileExists(routePath, FileType.File))) {
    printAndExit(`No route file exists as the project root: ${dir}`);
  }

  // create nlite dir
  await promises.rm(path.join(dir, ".nlite"), {
    recursive: true,
    force: true
  });
  const nliteDir = path.join(dir, ".nlite");
  await promises.mkdir(`${nliteDir}/static/media`, { recursive: true });
  await promises.mkdir(`${nliteDir}/static/chunks`, { recursive: true });
  await promises.mkdir(`${nliteDir}/server`, { recursive: true });

  let serverWatch: BuildContext;
  chokidar.watch(routePath).on("all", async () => {
    const routes = await tsImport(routePath, import.meta.url);
    serverWatch?.dispose();
    serverWatch = await build(routes.default, dir);

    // generate route trie
    // generate route entries
  });

  // create static script
  // const script = path.join(nliteDir, "static", "development", "_entry.js");
  // if (!(await fileExists(script, FileType.File))) {
  //   await promises.mkdir(path.join(nliteDir, "static", "development"), {
  //     recursive: true
  //   });
  //   await promises.writeFile(script, "");
  // }

  // Create http server
  const app = express();

  app.use("/.nlite/static", sirv(".nlite/static/", { extensions: [] }));
  // app.use("*all", controller(vite, dir));

  // Start http server
  app.listen(port, () => {
    console.log(`App running at http://localhost:${port}`);
  });
};
