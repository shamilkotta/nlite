import path from "path";
import { promises } from "fs";
import { tsImport } from "tsx/esm/api";

import { fileExists, FileType, getProjectDir } from "../utils/resolveDir";
import { printAndExit } from "../utils";
import { build } from "../server/build.prod";
import { parseRotues, updateRouteFromBuild } from "../server/processRoutes";
import { rm, writeFile } from "fs/promises";

type BuildOptions = object;

export const nliteBuild = async (_: BuildOptions, directory?: string) => {
  const now = Date.now();
  console.log("Nlite build initialised...");
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
  await Promise.all([
    promises.mkdir(`${nliteDir}/server/media`, { recursive: true }),
    promises.mkdir(`${nliteDir}/static/chunks`, { recursive: true }),
    promises.mkdir(`${nliteDir}/server/chunks`, { recursive: true }),
    promises.mkdir(`${nliteDir}/static/css`, { recursive: true }),
    promises.mkdir(`${nliteDir}/static/media`, { recursive: true }),
    promises.mkdir(`${nliteDir}/.cache/development`, { recursive: true })
  ]);

  const routes = await tsImport(routePath, import.meta.url);

  const { store, routeTree } = await parseRotues(routes.default, dir);
  await build(store, dir);
  await updateRouteFromBuild(routeTree, store, dir);

  await writeFile(
    path.join(dir, ".nlite/server/_route"),
    routeTree.serializeTrie()
  );
  rm(path.join(dir, ".nlite/.cache/development"), { recursive: true });
  const later = Date.now();
  console.log(`Build completed...(${later - now}ms)`);
};
