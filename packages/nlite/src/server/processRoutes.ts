import path from "path";
import fs from "fs/promises";

import { generateEntry } from "./generateEntry";
import { Route } from "..";
import RouteTrie from "./routeTrie";
import { getFileName } from "../utils/readBuild";

type Store = {
  path: string;
  file: string;
  rendering?: "default" | "ssr" | "ssg";
  incremental?: string;
};

const generateModuels = async (
  routeList: Route[],
  parentModule: string | null,
  parent: string,
  dir: string,
  store: Store[],
  routeTree: RouteTrie
) => {
  for (let i = 0; i < routeList.length; i++) {
    const route = routeList[i];
    let uri = route.path?.trim() || "";
    uri =
      !uri.length || uri === "/"
        ? ""
        : "/" + uri.replace(/^\/*(.*?)\/*$/, "$1");

    // if the parent path is not empty then dont' take the elemnt from empty or index route
    // if (uri == "" && parent != "" && route.element) route.element = undefined;

    // generate wrapped entry point for the route
    // (wrapped - wraps the element with layouts, error boundary etc)
    const file = await generateEntry(route, parentModule, dir);
    const newPath = parent + uri;
    store.push({
      path: newPath,
      file: file || "",
      rendering: route.rendering,
      incremental: route.incremental
    });
    routeTree.insert(newPath, {
      module: file,
      rendering: route.rendering,
      css: [],
      incremental: route.incremental
    });

    // if the parent path ends with splat then don't go furhter for children
    if (route.children?.length && !newPath.endsWith("*")) {
      // recursively generate entry points for children
      await generateModuels(
        route.children,
        file || null,
        newPath,
        dir,
        store,
        routeTree
      );
    }
  }
};

export const parseRotues = async (routeList: Route[], dir: string) => {
  const store: Store[] = [];
  const routeTree = new RouteTrie();
  await generateModuels(routeList, null, "", dir, store, routeTree);
  return { store, routeTree };
};

export const updateRouteFromBuild = async (
  routeTree: RouteTrie,
  store: Store[],
  dir: string
) => {
  const serverManifest = JSON.parse(
    await fs.readFile(
      path.join(dir, ".nlite/server", "_meta_server.json"),
      "utf-8"
    )
  ) as Record<string, Record<string, any>>;
  const clientManifest = JSON.parse(
    await fs.readFile(
      path.join(dir, ".nlite/server", "_meta_client.json"),
      "utf-8"
    )
  );

  const serverFiles = Object.entries(serverManifest.outputs);
  // iterate over each route paths
  for (const item of store) {
    const { file, path: routePath } = item;
    const name = path.parse(file).name;
    for (const [key, value] of serverFiles) {
      const buildFile = getFileName(key);
      // find curresponding compailed file for the route
      if (buildFile === name) {
        const css = new Set<string>();
        // get css bundle
        if (value.cssBundle) css.add(path.basename(value.cssBundle));
        // check on inner imports for css bundle
        processImports(value.imports, css, serverManifest, clientManifest);

        routeTree.insert(routePath, {
          module: key,
          rendering: item.rendering,
          incremental: item.incremental,
          css: [...css]
        });
        break;
      }
    }
  }
};

const processImports = (
  imports: Record<string, string>[],
  css: Set<string>,
  serverManifest: Record<string, Record<string, any>>,
  clientManifest: Record<string, Record<string, any>>
) => {
  const chunks = imports?.filter(
    (el: Record<string, string>) =>
      el.kind == "import-statement" &&
      el.path.startsWith(".nlite/server/chunks/")
  );
  if (chunks?.length) {
    for (const chunk of chunks) {
      const chunkOutput = serverManifest.outputs[chunk.path];
      if (chunkOutput.cssBundle) css.add(path.basename(chunkOutput.cssBundle));
      // go through chunks again for getting client component and css imports
      processImports(chunkOutput.imports, css, serverManifest, clientManifest);
    }
  }

  const clients = imports?.filter(
    (el) =>
      el.kind == "import-statement" &&
      el.external &&
      el.path.startsWith("/_nlite")
  );
  const clientEntries = Object.entries(clientManifest.outputs);
  if (clients?.length) {
    for (const client of clients) {
      const clientOutput = clientEntries.find(
        ([key]) => getFileName(key) == path.parse(client.path).name
      );
      if (clientOutput && clientOutput[1]?.cssBundle)
        css.add(path.basename(clientOutput[1]?.cssBundle));
    }
  }
};
