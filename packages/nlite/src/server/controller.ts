import { Request, Response } from "express";
// @ts-expect-error no declaration file
import ReactServerDOM from "react-server-dom-esm/server.node";
import { createElement } from "react";
import path from "path";
import { Transform } from "node:stream";

import RouteTrie from "./routeTrie";
import { generateTags } from "../rendering";

export const controller =
  (dir: string, routeTree: RouteTrie) => async (_: Request, res: Response) => {
    const routePath = _?.path;

    const matchedRoute = routeTree.match(routePath);

    if (!matchedRoute || !matchedRoute.match || !matchedRoute.match.module) {
      // TODO: handle 404 route (ideally render user provided or global 404 page)
      res.status(404).send("Not found");
      return;
    }

    const css = generateTags(matchedRoute.match.css);
    // TODO: use chached html from build
    res.write(
      `<html lang="en">
        <head>
          <meta charSet="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          ${css.map((el) => `<link rel="stylesheet" href="${el.link}" />`)}
        </head>
        <body>
        <div id="root"></div>
        <script type="module" src="/_nlite/_entry.js" async></script>
        <script>
          self.__nlite_f = self.__nlite_f || []
        </script>
    `
    );

    const pagePath = path.join(dir, matchedRoute.match.module!);
    const Page = await import(pagePath);
    const Comp = createElement(Page.default);

    const { pipe } = ReactServerDOM.renderToPipeableStream(Comp, "");

    // TODO: Error handling
    const transformStream = new Transform({
      transform(chunk, encoding, callback) {
        const wrappedChunk = `
          <script>
            self.__nlite_f.push([1, ${JSON.stringify(chunk.toString())}]);
          </script>
        `;
        res.write(wrappedChunk, encoding);
        callback();
      }
    });

    transformStream.on("finish", () => {
      res.end("</body></html>");
    });

    pipe(transformStream);
  };
