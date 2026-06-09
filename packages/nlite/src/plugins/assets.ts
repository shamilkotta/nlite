import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { Plugin } from "vite";

const VIRTUAL_ASSETS_ID = "virtual:nlite/assets";
const RESOLVED_VIRTUAL_ASSETS_ID = `\0${VIRTUAL_ASSETS_ID}`;

export const DEV_SCRIPTS_PATH = "/_nlite/scripts.js";
export const DEV_STYLES_PATH = "/_nlite/styles.css";

export function assets(): Plugin {
  const frameworkRoot = path.dirname(fileURLToPath(import.meta.url));
  const scriptsEntry = path.join(frameworkRoot, "assets/scripts.js");
  const stylesEntry = path.join(frameworkRoot, "assets/styles.css");
  let scriptsUrl: string | null = null;
  let stylesUrl: string | null = null;

  return {
    name: "nlite:assets",
    configEnvironment(name, config) {
      if (name !== "client") {
        return;
      }

      const input = config.build?.rolldownOptions?.input;
      if (!input || typeof input !== "object" || Array.isArray(input)) {
        return;
      }

      input["nlite-scripts"] = scriptsEntry;
      input["nlite-styles"] = stylesEntry;
    },
    configureServer(server) {
      server.middlewares.use(
        createAssetsDevMiddleware({
          scriptsEntry,
          stylesEntry,
        }),
      );
    },
    resolveId(id) {
      if (id === VIRTUAL_ASSETS_ID) {
        return RESOLVED_VIRTUAL_ASSETS_ID;
      }

      return;
    },
    load(id) {
      if (id === RESOLVED_VIRTUAL_ASSETS_ID) {
        const scripts =
          scriptsUrl ??
          (this.environment.mode === "dev"
            ? `${this.environment.config.base.replace(/\/$/, "")}${DEV_SCRIPTS_PATH}`
            : null);
        const styles =
          stylesUrl ??
          (this.environment.mode === "dev"
            ? `${this.environment.config.base.replace(/\/$/, "")}${DEV_STYLES_PATH}`
            : null);

        return `export const scripts = ${JSON.stringify(scripts)};
        export const styles = ${JSON.stringify(styles)};`;
      }

      return;
    },
    applyToEnvironment(environment) {
      return environment.name === "client" || environment.name === "ssr";
    },
    writeBundle(_options, bundle) {
      if (this.environment.name !== "client") {
        return;
      }

      for (const output of Object.values(bundle)) {
        if (output.type === "chunk" && output.name === "nlite-scripts") {
          scriptsUrl = `/${output.fileName.replace(/\\/g, "/")}`;
        }

        if (output.type !== "asset" || !output.fileName.endsWith(".css")) {
          continue;
        }

        const source =
          typeof output.source === "string"
            ? output.source
            : output.source instanceof Uint8Array
              ? Buffer.from(output.source).toString("utf8")
              : "";

        // TODO: styles check need improvement
        if (source.includes("._nlite_status_")) {
          stylesUrl = `/${output.fileName.replace(/\\/g, "/")}`;
        }
      }
    },
  };
}

export function createAssetsDevMiddleware(files: { scriptsEntry: string; stylesEntry: string }) {
  return (
    req: import("node:http").IncomingMessage,
    res: import("node:http").ServerResponse,
    next: () => void,
  ) => {
    const url = req.url?.split("?")[0];

    if (url === DEV_SCRIPTS_PATH) {
      res.setHeader("Content-Type", "application/javascript");
      res.end(fs.readFileSync(files.scriptsEntry));
      return;
    }

    if (url === DEV_STYLES_PATH) {
      res.setHeader("Content-Type", "text/css");
      res.end(fs.readFileSync(files.stylesEntry));
      return;
    }

    next();
  };
}
