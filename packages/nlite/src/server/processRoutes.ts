import path from "path";
import fs from "fs/promises";

import { generateEntry } from "./generateEntry";
import { Route } from "..";
import RouteTrie from "./routeTrie";
import { getFileName } from "../utils/readBuild";

type Store = {
  path: string;
  file: string;
  middleware: boolean;
  prerender?: boolean;
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

    const file = await generateEntry(route, parentModule, dir);
    const newPath = parent + uri;
    store.push({
      path: newPath,
      file: file || "",
      middleware: Boolean(route.middleWare),
      prerender: route.prerender
    });
    routeTree.insert(newPath, {
      middleWare: Boolean(route.middleWare),
      module: file,
      prerender: route.prerender,
      css: []
    });

    // if the parent path ends with splat then don't go furhter for children
    if (route.children?.length && !newPath.endsWith("*")) {
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
  for (const item of store) {
    const { file, path: routePath } = item;
    const name = path.parse(file).name;
    for (const [key, value] of serverFiles) {
      const buildFile = getFileName(key);
      if (buildFile === name) {
        const css = new Set<string>();
        if (value.cssBundle) css.add(path.basename(value.cssBundle));
        processImports(value.imports, css, serverManifest, clientManifest);

        routeTree.insert(routePath, {
          module: key,
          middleWare: item.middleware,
          prerender: item.prerender,
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
