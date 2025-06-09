declare global {
  interface Window {
    __nlite_f: Array<[number, any]>;
  }
}

import { createElement, use, useState } from "react";
import { hydrateRoot } from "react-dom/client";
// @ts-expect-error no declaration file
import { createFromReadableStream } from "react-server-dom-esm/client";

function processRSCStream() {
  const rscStream = new ReadableStream({
    start(controller) {
      let index = 0;
      const encoder = new TextEncoder();
      const checkInterval = setInterval(() => {
        while (index < self.__nlite_f?.length) {
          const [type, chunk] = self.__nlite_f[index];
          if (type === 1) {
            const binaryChunk = encoder.encode(chunk);
            controller.enqueue(binaryChunk);
          }
          index++;
        }
      }, 50);

      // TODO: handle end signal
      window.addEventListener("load", () => {
        setTimeout(() => {
          clearInterval(checkInterval);
          controller.close();
        }, 1000); // Give it a bit more time to receive all chunks
      });
    }
  });

  return rscStream;
}

// Reconstruct the stream from chunks
const rscStream = processRSCStream();

const Shell = ({ data }: { data: any }) => {
  const [root] = useState<any>(use(data));
  return root;
};

// Hydrate the app
hydrateRoot(
  document.getElementById("root")!,
  createElement(Shell, { data: createFromReadableStream(rscStream) })
);
