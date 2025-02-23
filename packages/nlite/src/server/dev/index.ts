import path from "node:path";
import { Response, Request } from "express";
import { Transform } from "node:stream";
import { ViteDevServer } from "vite";

import { parseRoute } from "./pareseRoute";
import _layout from "../../_layout";
import { render } from "../_entry";
import { generateEntry } from "../generateEntry";

const ABORT_DELAY = 10000;
let template = _layout();

export const controller =
  (vite: ViteDevServer, dir: string) => async (req: Request, res: Response) => {
    try {
      const url = req.originalUrl;

      // Get components
      const absPath = path.join(dir, "./routes");
      const routes = (await vite.ssrLoadModule(absPath)).default;
      const {
        jsx: App,
        styles,
        script
      } = await parseRoute(url, routes, vite, dir);

      // TODO: null case for App (404)

      // load script
      await generateEntry(script, dir);

      // load html
      template = await vite.transformIndexHtml(url, template);

      // load css
      template = template.replace("<!--dev-ssr-css-->", styles || "");

      let didError = false;
      const { pipe, abort } = render(url, App!, {
        onShellError() {
          res.status(500);
          res.set({ "Content-Type": "text/html" });
          res.send("<h1>Something went wrong</h1>");
        },
        onShellReady() {
          res.status(didError ? 500 : 200);
          res.set({ "Content-Type": "text/html" });

          const transformStream = new Transform({
            transform(chunk, encoding, callback) {
              res.write(chunk, encoding);
              callback();
            }
          });

          const [htmlStart, htmlEnd] = template.split(`<!--app-html-->`);

          res.write(htmlStart);

          transformStream.on("finish", () => {
            res.end(htmlEnd);
          });

          pipe(transformStream);
        },
        onError(error: unknown) {
          didError = true;
          console.error(error);
        }
      });

      setTimeout(() => {
        abort();
      }, ABORT_DELAY);
    } catch (e) {
      vite?.ssrFixStacktrace(e as Error);
      res.status(500).end((e as Error).stack);
    }
  };
