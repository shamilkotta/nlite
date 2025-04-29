import React from "react";
import { PassThrough } from "stream";
// @ts-expect-error react server
import ReactDOMClient from "react-server-dom-esm/client.node";
import ReactDOMServer from "react-dom/static";

const args = process.argv.slice(2);
const dir = args[0];

let collectedStream = new PassThrough();
process.on("message", async (msg: any) => {
  if (msg.type == "rscData") {
    collectedStream.write(msg.chunk);
  } else if (msg.type === "end") {
    collectedStream.end();
    const Root = () => {
      const cachedResult = ReactDOMClient.createFromNodeStream(
        collectedStream,
        dir,
        ""
      );
      return React.use<any>(cachedResult).root;
    };

    const { prelude } = await ReactDOMServer.prerenderToNodeStream(
      React.createElement(Root),
      {}
    );

    const htmlPassThrough = new PassThrough();
    prelude.pipe(htmlPassThrough);

    // Send HTML chunks back to parent
    htmlPassThrough.on("data", (chunk) => {
      process.send?.({ type: "htmlData", chunk: chunk.toString("utf8") });
    });

    htmlPassThrough.on("end", () => {
      resetCollecter();
      process.send?.({ type: "end" });
    });
  }
});

const resetCollecter = () => {
  collectedStream.removeAllListeners();
  collectedStream.destroy();
  collectedStream = new PassThrough();
};
