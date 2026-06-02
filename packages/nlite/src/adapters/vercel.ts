import { promises as fs } from "node:fs";
import path from "node:path";
import type { Plugin, PluginOption, ResolvedConfig } from "vite";

import type { NliteUserConfig } from "../config.js";
import { resolveStaleTimes, STALE_TIME_HEADER } from "../utils/constants.js";

export interface VercelAdapterOptions {
  runtime?: "edge";
}

const FUNCTION_NAME = "__nlite";

export function vercel(options: VercelAdapterOptions = {}): PluginOption[] {
  let config: ResolvedConfig;
  let staticStaleTimeSeconds: number;

  const plugin: Plugin = {
    name: "nlite:vercel",
    apply: "build",
    enforce: "post",
    applyToEnvironment(environment) {
      return environment.name === "api";
    },
    configResolved(resolvedConfig) {
      config = resolvedConfig;
      staticStaleTimeSeconds = resolveStaleTimes(
        (resolvedConfig as unknown as NliteUserConfig).nlite?.staleTimes,
      ).static;
    },
    async closeBundle() {
      const root = config.root;
      const outputDir = path.resolve(root, config.build.outDir);
      const clientOutDir = path.resolve(root, config.environments.client.build.outDir);
      const serverOutDir = path.resolve(root, config.environments.rsc.build.outDir);

      const staticDir = path.join(outputDir, "static");
      await moveIfExists(clientOutDir, staticDir);
      const overrides = await collectStaticOverrides(staticDir, {
        [STALE_TIME_HEADER]: String(staticStaleTimeSeconds),
      });

      const functionDir = path.join(outputDir, "functions", `${FUNCTION_NAME}.func`);
      await moveIfExists(serverOutDir, functionDir);
      await writeFunctionEntrypoint(functionDir);
      await writeFunctionConfig(functionDir, options.runtime ?? "edge");
      await writeVercelConfig(outputDir, overrides);

      config.logger.info(`[nlite] Vercel Build ready in ${path.relative(root, outputDir)}`);
    },
  };

  return [plugin];
}

async function moveIfExists(source: string, destination: string) {
  if (!(await exists(source))) {
    return;
  }

  await fs.rm(destination, { recursive: true, force: true });
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.rename(source, destination);
}

async function writeFunctionConfig(functionDir: string, runtime: "edge") {
  await fs.mkdir(functionDir, { recursive: true });
  await fs.writeFile(
    path.join(functionDir, ".vc-config.json"),
    `${JSON.stringify(
      {
        runtime,
        entrypoint: "vercel-entry.js",
      },
      null,
      2,
    )}\n`,
  );
}

async function writeFunctionEntrypoint(functionDir: string) {
  await fs.mkdir(functionDir, { recursive: true });
  await fs.writeFile(
    path.join(functionDir, "vercel-entry.js"),
    `import { handler } from "./index.js";

export default function nliteVercelHandler(request) {
  return handler(request);
}
`,
  );
}

async function writeVercelConfig(outputDir: string, overrides: VercelOverrides) {
  await fs.writeFile(
    path.join(outputDir, "config.json"),
    `${JSON.stringify(
      {
        version: 3,
        routes: [{ handle: "filesystem" }, { src: "/(.*)", dest: `/${FUNCTION_NAME}` }],
        overrides,
      },
      null,
      2,
    )}\n`,
  );
}

type VercelOverrides = Record<string, { path?: string; headers?: Record<string, string> }>;

async function collectStaticOverrides(
  staticDir: string,
  rscHeaders: Record<string, string>,
): Promise<VercelOverrides> {
  if (!(await exists(staticDir))) {
    return {};
  }

  const overrides: VercelOverrides = {};

  for (const file of await collectStaticFiles(staticDir)) {
    const relative = toPosix(path.relative(staticDir, file));

    if (relative.endsWith(".rsc")) {
      overrides[relative] = {
        headers: rscHeaders,
      };
      continue;
    }

    if (relative.endsWith(".html") && !["404.html", "index.html"].includes(relative)) {
      overrides[relative] = {
        path: relative.slice(0, -".html".length),
      };
    }
  }

  return overrides;
}

async function collectStaticFiles(directory: string): Promise<string[]> {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        return collectStaticFiles(entryPath);
      }

      if (entry.isFile()) {
        return [entryPath];
      }

      return [];
    }),
  );

  return files.flat();
}

function toPosix(value: string) {
  return value.split(path.sep).join("/");
}

async function exists(filePath: string) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
