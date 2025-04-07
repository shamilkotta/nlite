import path from "path";
import { rm, writeFile, mkdir } from "fs/promises";
import { tsImport } from "tsx/esm/api";

import { fileExists, FileType, getProjectDir } from "../utils/resolveDir";
import { printAndExit } from "../utils";
import { build } from "../build";
import { parseRotues, updateRouteFromBuild } from "../server/processRoutes";

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
  await rm(path.join(dir, ".nlite"), {
    recursive: true,
    force: true
  });
  const nliteDir = path.join(dir, ".nlite");
  await Promise.all([
    mkdir(`${nliteDir}/static/chunks`, { recursive: true }),
    mkdir(`${nliteDir}/server/chunks`, { recursive: true }),
    mkdir(`${nliteDir}/static/css`, { recursive: true }),
    mkdir(`${nliteDir}/static/media`, { recursive: true }),
    mkdir(`${nliteDir}/.cache/development`, { recursive: true })
  ]);

  const routes = await tsImport(routePath, import.meta.url);

  // generate route tree and entry points
  const { store, routeTree } = await parseRotues(routes.default, dir);
  // build entry points
  await build(store, dir);
  // update route tree with compailed files
  await updateRouteFromBuild(routeTree, store, dir);
  rm(path.join(dir, ".nlite/.cache/development"), { recursive: true });

  await writeFile(
    path.join(dir, ".nlite/server/_route"),
    routeTree.serializeTrie()
  );

  const later = Date.now();
  console.log(`Build completed...(${later - now}ms)`);
};
