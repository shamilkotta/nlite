import express from "express";
import sirv from "sirv";
import fs from "fs/promises";
import path from "path";

import { getProjectDir } from "../utils/resolveDir";
import { nliteBuild } from "./nlite-build";
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
  await nliteBuild(_, directory);
  const dir = getProjectDir(directory);
  const routeCache = await fs.readFile(
    path.join(dir, ".nlite/server", "_route")
  );
  const routeTree = RouteTrie.deSerializeTrie(routeCache);

  // Create http server
  const app = express();

  app.use("/_nlite/:path", sirv(".nlite/static/", { extensions: [] }));

  app.get("/", (_, res) => {
    res.status(200).send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>React Server Components from Scratch</title>
    </head>
    <body>
      <div id="root"></div>
      <script type="module" src="/_nlite/_entry.js"></script>
    </body>
    </html>
	`);
  });

  app.use("*all", controller(dir, routeTree));

  // Start http server
  app.listen(port, () => {
    console.log(`App running at http://localhost:${port}`);
  });
};
