import React, { createElement } from "react";
import fs from "fs";
import path from "path";
// @ts-expect-error react server
import ReactDOMClient from "react-server-dom-esm/client.node";
import ReactDOMServer from "react-dom/static";

import { Route } from "../server/routeTrie";
import Layout from "../static/_layout";
import { generateTags } from ".";
import { PassThrough } from "stream";

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
  const nliteEntry = await import(
    path.join(dir, ".nlite/server", "_index.cjs")
  );
  const { prelude }: { prelude: NodeJS.ReadableStream } =
    await nliteEntry.prerenderToNodeStream(Comp, "");

  const fileName = path.parse(page).name;
  const rscPath = path.join(dir, ".nlite/server", fileName + ".rsc");
  const rscWrite = fs.createWriteStream(rscPath);

  const pass = new PassThrough();

  prelude.pipe(pass);
  pass.pipe(rscWrite);

  const Root = () => {
    const cachedResult = ReactDOMClient.createFromNodeStream(pass, dir, "");
    return React.use<any>(cachedResult).root;
  };

  const { prelude: htmlPrelude } = await ReactDOMServer.prerenderToNodeStream(
    React.createElement(Root),
    {}
  );
  const htmlPath = path.join(dir, ".nlite/server", fileName + ".html");
  const htmlWrite = fs.createWriteStream(htmlPath);
  htmlPrelude.pipe(htmlWrite);

  await Promise.all([
    new Promise((resolve, reject) =>
      rscWrite.on("finish", () => resolve(true)).on("error", reject)
    ),
    new Promise((resolve, reject) =>
      htmlWrite.on("finish", () => resolve(true)).on("error", reject)
    )
  ]);

  return { html: htmlPath, rsc: rscPath };
};
