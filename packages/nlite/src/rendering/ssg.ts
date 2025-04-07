import React, { createElement } from "react";
import fs from "fs";
import path from "path";
import { PassThrough } from "node:stream";
// @ts-expect-error react server
import ReactDOMStatic from "react-server-dom-esm/static.node";
// @ts-expect-error react server
import ReactDOMClient from "react-server-dom-esm/client.node";
// import ReactDOMServer from "react-dom/server.node";

import { Route } from "../server/routeTrie";
import Layout from "../static/_layout";
import { generateTags } from ".";

export const ssg = async (
  dir: string,
  module: Route
): Promise<{ html: string; rsc: string } | undefined> => {
  const { css, module: page } = module;
  if (!page) return;
  const element = (await import(path.join(dir, page))).default;
  if (!element) return;

  let cssTags: { name: string; link: string }[] = [];
  if (css && css.length > 0) {
    cssTags = generateTags(css);
  }
  const Comp = createElement(Layout, { css: cssTags }, createElement(element));
  const { prelude }: { prelude: NodeJS.ReadableStream } =
    await ReactDOMStatic.unstable_prerenderToNodeStream(Comp, "/", {
      bootstrapModules: ["/_nlite/_entry.js"],
      onError: (err: any) => {
        console.log({ er: err });
      }
    });

  const fileName = path.parse(page).name;
  const rscPath = path.join(dir, ".nlite/server", fileName + ".rsc");
  const rscWrite = fs.createWriteStream(rscPath);
  prelude.pipe(rscWrite);

  const passThrough = new PassThrough();
  prelude.pipe(passThrough);

  const Root = () => {
    const cachedResult = ReactDOMClient.createFromNodeStream(passThrough);
    return React.use<any>(cachedResult).root;
  };
  const htmlPath = path.join(dir, ".nlite/server", fileName + ".html");
  const htmlWrite = fs.createWriteStream(htmlPath);
  console.log({ Root });

  // const { pipe } = ReactDOMServer.renderToPipeableStream(
  //   React.createElement(Root),
  //   {
  //     onShellReady() {
  //       pipe(htmlWrite);
  //     },
  //     onShellError(error) {
  //       console.log({ error });
  //     }
  //   }
  // );

  // const { pipe } = ReactDOMServer.renderToPipeableStream(Comp);
  // const rscPath = path.join(dir, ".nlite/server", fileName + ".rsc");
  // const rscStream = fs.createWriteStream(rscPath);
  // await pipeline(pipe(), rscStream);

  return new Promise((resolve, reject) => {
    htmlWrite.on("finish", () => {
      resolve({ html: htmlPath, rsc: rscPath });
    });

    htmlWrite.on("error", (err) => {
      console.log({ err });

      reject(err);
    });
  });
};
