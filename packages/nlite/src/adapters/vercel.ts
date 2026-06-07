import { promises as fs } from "node:fs";
import path from "node:path";
import type { Plugin, PluginOption, ResolvedConfig } from "vite";

import type { NliteOptions } from "../types.js";
import { NOT_FOUND_RSC_FILE, resolveStaleTimes, STALE_TIME_HEADER } from "../utils/constants.js";
import { tryCatch } from "../utils/index.js";

export interface VercelAdapterOptions {}

const FUNCTION_NAME = "__nlite";
const SERVER_BUNDLE_DIR = "server";
const VERCEL_OUTPUT_DIR = ".vercel/output";
const STATIC_RSC_ROUTE = "/(.*\\.rsc)";
const CLEAN_URL_ROUTE = "/((?:[^/]+/)*[^/.]+)$";

export function vercel(_options: VercelAdapterOptions = {}): PluginOption[] {
  let config: ResolvedConfig;
  let staleTimes: { static: number; dynamic: number };

  const plugin: Plugin = {
    name: "nlite:vercel",
    apply: "build",
    enforce: "post",
    applyToEnvironment(environment) {
      return environment.name === "api";
    },
    configResolved(resolvedConfig) {
      config = resolvedConfig;
      staleTimes = resolveStaleTimes(
        (resolvedConfig as unknown as { nlite?: NliteOptions }).nlite?.staleTimes,
      );
    },
    async closeBundle() {
      const root = config.root;
      const clientOutDir = path.resolve(root, config.environments.client.build.outDir);
      const serverOutDir = path.resolve(root, config.environments.rsc.build.outDir);

      if (!(await exists(serverOutDir))) {
        config.logger.warn("[nlite] Vercel adapter skipped: server bundle was not found.");
        return;
      }

      const outputDir = path.join(root, VERCEL_OUTPUT_DIR);
      await fs.rm(outputDir, { recursive: true, force: true });

      await copyDir(clientOutDir, path.join(outputDir, "static"));
      const runtime = "nodejs24.x";
      await writeVercelFunction(root, serverOutDir, runtime);
      await writeVercelConfig(root, staleTimes);

      config.logger.info(`[nlite] Vercel build ready in ${path.relative(root, outputDir)}.`);
    },
  };

  return [plugin];
}

async function writeVercelFunction(root: string, serverOutDir: string, runtime: string) {
  const functionDir = path.join(root, `${VERCEL_OUTPUT_DIR}/functions`, `${FUNCTION_NAME}.func`);

  await fs.mkdir(functionDir, { recursive: true });
  await copyDir(serverOutDir, path.join(functionDir, SERVER_BUNDLE_DIR));

  await Promise.all([
    fs.writeFile(path.join(functionDir, "entry.js"), `${createHandlerSource()}\n`),
    writeFunctionPackageJson(functionDir),
    writeFunctionConfig(functionDir, runtime),
  ]);
}

function createHandlerSource() {
  return `import { handler } from "./${SERVER_BUNDLE_DIR}/index.js";

const ASSETS = {
  fetch(request) {
    return fetch(request);
  },
};

export default {
  fetch(request, _env) {
    return handler(request, { ..._env, ASSETS });
  },
};
`;
}

async function writeFunctionPackageJson(functionDir: string) {
  await fs.writeFile(
    path.join(functionDir, "package.json"),
    `${JSON.stringify({ type: "module" }, null, 2)}\n`,
  );
}

async function writeFunctionConfig(functionDir: string, runtime: string) {
  await fs.writeFile(
    path.join(functionDir, ".vc-config.json"),
    `${JSON.stringify(
      {
        runtime,
        handler: "entry.js",
        launcherType: "Nodejs",
        supportsResponseStreaming: true,
      },
      null,
      2,
    )}\n`,
  );
}

async function writeVercelConfig(root: string, staleTimes: { static: number; dynamic: number }) {
  const outputDir = path.join(root, VERCEL_OUTPUT_DIR);

  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(
    path.join(outputDir, "config.json"),
    `${JSON.stringify(
      {
        version: 3,
        routes: [
          {
            src: STATIC_RSC_ROUTE,
            headers: { [STALE_TIME_HEADER]: String(staleTimes.static) },
            continue: true,
          },
          {
            src: `/${NOT_FOUND_RSC_FILE}`,
            headers: { [STALE_TIME_HEADER]: String(staleTimes.dynamic) },
            continue: true,
          },
          {
            src: CLEAN_URL_ROUTE,
            dest: "/$1.html",
            check: true,
          },
          { handle: "filesystem" },
          {
            src: "/(.*)",
            dest: `/${FUNCTION_NAME}`,
            headers: { [STALE_TIME_HEADER]: String(staleTimes.dynamic) },
          },
        ],
      },
      null,
      2,
    )}\n`,
  );
}

async function copyDir(source: string, destination: string) {
  if (!(await exists(source))) {
    return;
  }

  await fs.rm(destination, { recursive: true, force: true });
  await fs.cp(source, destination, { recursive: true, force: true });
}

async function exists(filePath: string) {
  const [_, error] = await tryCatch(fs.access(filePath));
  if (error) {
    return false;
  }
  return true;
}
