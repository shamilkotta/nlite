import express from "express";
import path from "path";
import { promises } from "fs";
import sirv from "sirv";

import { fileExists, FileType, getProjectDir } from "../utils/resolveDir";
import { printAndExit } from "../utils";
import { controller } from "../server/dev";

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

  const routePate = path.join(dir, "routes");
  if (!(await fileExists(routePate, FileType.File))) {
    printAndExit(`No route file exists as the project root: ${dir}`);
  }

  // create nlite dir
  const nliteDir = path.join(dir, ".nlite");
  if (!(await fileExists(nliteDir, FileType.Directory))) {
    await promises.mkdir(nliteDir);
  }

  // create static script
  const script = path.join(nliteDir, "static", "development", "_entry.js");
  if (!(await fileExists(script, FileType.File))) {
    await promises.mkdir(path.join(nliteDir, "static", "development"), {
      recursive: true
    });
    await promises.writeFile(script, "");
  }

  // Create http server
  const app = express();

  const base = process.env.BASE || "/"; // TODO: check on this

  // Add Vite or respective production middlewares
  const { createServer } = await import("vite");
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: "custom",
    cacheDir: "./.nlite/cache",
    configFile: "./nlite.config.ts",
    base
  });
  app.use(vite.middlewares);
  app.use("/.nlite/static", sirv(".nlite/static/", { extensions: [] }));
  app.use("*all", controller(vite, dir));

  // Start http server
  app.listen(port, () => {
    console.log(`Server started at http://localhost:${port}`);
  });
};
