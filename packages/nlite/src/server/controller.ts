import { Request, Response } from "express";
// @ts-expect-error no declaration file
import ReactServerDOM from "react-server-dom-esm/server.node";
// import ReactDOM from "react-dom/server.node";
import { createElement } from "react";
import path from "path";

import RouteTrie from "./routeTrie";

export const controller =
  (dir: string, routeTree: RouteTrie) => async (_: Request, res: Response) => {
    const routePath = _?.path;
    console.log({ url: _?.url });

    const matchedRoute = routeTree.match(routePath);
    console.log({ routePath, matchedRoute });

    if (!matchedRoute || !matchedRoute.match || !matchedRoute.match.module) {
      // TODO: handle 404 route (ideally render user provided or global 404 page)
      res.status(404).send("Not found");
      return;
    }

    const pagePath = path.join(dir, matchedRoute.match.module!);
    // const pagePath = path.join(dir, ".nlite/server", "[Iwr-p1]-IRL7SA6C.js");
    const Page = await import(pagePath);
    const Comp = createElement(Page.default);

    const { pipe } = ReactServerDOM.renderToPipeableStream(Comp);
    pipe(res);
  };
