import { createElement } from "react";
import fs from "fs";
import path from "path";
import { ChildProcess } from "node:child_process";
// @ts-expect-error react server
import ReactDOMStatic from "react-server-dom-esm/static.node";

import { Route } from "../server/routeTrie";
import Layout from "../static/_layout";
import { generateTags } from ".";
import { printAndExit } from "../utils";

export const ssg = async (
  dir: string,
  module: Route,
  client: ChildProcess
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
    await ReactDOMStatic.unstable_prerenderToNodeStream(Comp, "");

  const fileName = path.parse(page).name;
  const rscPath = path.join(dir, ".nlite/server", fileName + ".rsc");
  const rscWrite = fs.createWriteStream(rscPath);
  prelude.pipe(rscWrite);

  prelude.on("data", (chunk) => {
    client.send({ type: "rscData", chunk: chunk });
  });
  prelude.on("end", () => {
    client.send({ type: "end" });
  });
  prelude.on("error", (err) => {
    client.kill();
    printAndExit(err.message);
  });

  const htmlPath = path.join(dir, ".nlite/server", fileName + ".html");
  return new Promise((resolve, reject) => {
    const htmlWrite = fs.createWriteStream(htmlPath);
    function onMessage(msg: any) {
      console.log({ msg });

      if (msg.type === "htmlData") {
        htmlWrite.write(msg.chunk);
        htmlWrite.on("error", (err) => {
          client.off("message", onMessage);
          reject(err);
        });
      } else if (msg.type === "error") {
        client.off("message", onMessage);
        reject(new Error("Error in child process"));
      } else if (msg.type === "end") {
        htmlWrite.end();
        client.off("message", onMessage);
        resolve({ html: htmlPath, rsc: rscPath });
      }
    }
    client.on("message", onMessage);
  });
};
