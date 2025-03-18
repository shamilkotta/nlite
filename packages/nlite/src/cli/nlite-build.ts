import path from "path";
import { promises } from "fs";
import { tsImport } from "tsx/esm/api";

import { fileExists, FileType, getProjectDir } from "../utils/resolveDir";
import { printAndExit } from "../utils";
import { build } from "../server/build.prod";
import { parseRotues } from "../server/processRoutes";

type BuildOptions = object;

export const nliteBuild = async (_: BuildOptions, directory?: string) => {
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

  const routes = await tsImport(routePath, import.meta.url);
  await build(routes.default, dir);

  await parseRotues(routes, dir);

  // generate route trie
  // generate route entries
};
