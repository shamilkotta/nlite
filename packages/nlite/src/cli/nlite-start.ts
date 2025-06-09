import express from "express";
import sirv from "sirv";
import fs from "fs/promises";
import path from "path";

import { getProjectDir } from "../utils/resolveDir";
import { controller } from "../server/controller";
import RouteTrie from "../server/routeTrie";

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
  const routeCache = await fs.readFile(
    path.join(dir, ".nlite/server", "_route")
  );
  const routeTree = RouteTrie.deSerializeTrie(routeCache);

  // Create http server
  const app = express();

  app.get("/_nlite/*path", sirv(".nlite/static/", { extensions: [] }));
  // app.get("/rsc", controller(dir, routeTree));
  app.get("*path", controller(dir, routeTree));

  // Start http server
  app.listen(port, () => {
    console.log(`App running at http://localhost:${port}`);
  });
};
