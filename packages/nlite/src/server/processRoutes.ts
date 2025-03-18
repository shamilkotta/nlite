import path from "path";
import { tsImport } from "tsx/esm/api";

import { generateEntry, Imports } from "./generateEntry";
import { Route } from "..";
import { readFile } from "fs/promises";

const loadModule = async (filePath: string, dir: string) => {
  const absPath = path.join(dir, filePath);
  const module = await tsImport(absPath, import.meta.url);
  return module;
};

const generateModuels = async (
  routeList: Route[],
  parentModule: string | null,
  parent: string,
  dir: string,
  store: {
    path: string;
    file: string;
  }[]
) => {
  for (let i = 0; i < routeList.length; i++) {
    const route = routeList[i];
    let uri = route.path?.trim() || "";
    uri =
      !uri.length || uri === "/"
        ? ""
        : "/" + uri.replace(/^\/*(.*?)\/*$/, "$1");

    // if the parent path is not empty then dont' take the elemnt from empty or index route
    if (uri == "" && parent != "" && route.element) route.element = undefined;

    const file = await generateEntry(route, file, dir);
    console.log({ uri, file });

    const newPath = parent + uri;
    // if element then i've to store the path

    // if the parent path ends with splat then don't go furhter for children
    if (route.children?.length && !newPath.endsWith("*")) {
      await generateModuels(route.children, file, newPath, dir, store);
    }
  }
};

export const parseRotues = async (routeList: Route[], dir: string) => {
  const store: {
    path: string;
    file: string;
  }[] = [];
  // const serverManifest = JSON.parse(
  //   await readFile(
  //     path.join(dir, ".nlite", "server/_meta_server.json"),
  //     "utf-8"
  //   )
  // );
  // const clientManifeset = JSON.parse(
  //   await readFile(
  //     path.join(dir, ".nlite", "server/_meta_client.json"),
  //     "utf-8"
  //   )
  // );

  // const manifest = {};
  // Object.assign(manifest, serverManifest.outputs, clientManifeset.outputs);
  await generateModuels(routeList, null, "", dir, store);
};

export const generateEntries = (routeList: Route[]) => {
  const entries = new Set<string>();

  const getEntry = (routeTree: Route[]) => {
    for (const route of routeTree) {
      if (route.module) entries.add(route.module);
      if (route.layout) entries.add(route.layout);
      if (route.error) entries.add(route.error);
      if (route.loading) entries.add(route.loading);

      if (route.children) {
        getEntry(route.children);
      }
    }
  };

  getEntry(routeList);
  return entries;
};
