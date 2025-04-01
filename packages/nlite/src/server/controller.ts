import { Request, Response } from "express";
// @ts-expect-error no declaration file
import ReactServerDOM from "react-server-dom-esm/server.node";
import { createElement } from "react";
import path from "path";

export const controller =
  (dir: string) => async (_: Request, res: Response) => {
    // Note This will raise a type error until you build with `npm run dev`
    const pagePath = path.join(dir, ".nlite/server/JY9Hu7-RLWJBRS6.js");
    const Page = await import(pagePath);
    const Comp = createElement(Page.default);

    const { pipe } = ReactServerDOM.renderToPipeableStream(Comp, "");
    pipe(res);
  };
