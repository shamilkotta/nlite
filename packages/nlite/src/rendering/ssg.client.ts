import React from "react";
import { PassThrough } from "stream";
// @ts-expect-error react server
import ReactDOMClient from "react-server-dom-esm/client.node";
import ReactDOMServer from "react-dom/server";

let collectedStream = new PassThrough();
process.on("message", (msg: any) => {
  if (msg.type == "rscData") {
    collectedStream.write(msg.chunk);
  } else if (msg.type === "end") {
    collectedStream.end();
    const Root = () => {
      const cachedResult = ReactDOMClient.createFromNodeStream(collectedStream);
      return React.use<any>(cachedResult).root;
    };

    const { pipe } = ReactDOMServer.renderToPipeableStream(
      React.createElement(Root),
      {
        onShellReady() {
          const htmlPassThrough = new PassThrough();
          pipe(htmlPassThrough);

          // Send HTML chunks back to parent
          htmlPassThrough.on("data", (chunk) => {
            process.send?.({ type: "htmlData", chunk: chunk.toString("utf8") });
          });

          htmlPassThrough.on("end", () => {
            resetCollecter();
            process.send?.({ type: "end" });
          });
        },
        onShellError(error) {
          resetCollecter();
          console.error(error);
          process.send?.({ type: "error" });
        }
      }
    );
  }
});

const resetCollecter = () => {
  collectedStream.removeAllListeners();
  collectedStream.destroy();
  collectedStream = new PassThrough();
};
