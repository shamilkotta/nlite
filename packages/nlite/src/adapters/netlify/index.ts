import { createRequire } from "node:module";
import { promises as fs, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Logger, Plugin, PluginOption, ResolvedConfig, UserConfig } from "vite";

import type { NliteOptions } from "../../types.js";
import { RSC_POSTFIX } from "../../utils/constants.js";
import { tryCatch } from "../../utils/index.js";
import {
  EDGE_FUNCTION_NAME,
  FUNCTION_NAME,
  FUNCTION_SERVER_DIR,
  NETLIFY_EDGE_FUNCTIONS_DIR,
  NETLIFY_FUNCTIONS_DIR,
  NETLIFY_OUTPUT_DIR,
  ORIGIN_PATH,
  ORIGIN_URL_HEADER,
  REDIRECTS_GENERATED_MARKER,
  ROOT_RSC_ALIAS,
} from "./constants.js";

export interface NetlifyAdapterOptions {}

const VIRTUAL_EDGE_ID = "virtual:nlite/netlify-edge";
const RESOLVED_VIRTUAL_EDGE_ID = `\0${VIRTUAL_EDGE_ID}`;
const EDGE_ENV = "netlify_edge";

export function netlify(_options: NetlifyAdapterOptions = {}): PluginOption[] {
  let config: ResolvedConfig;
  let nliteOptions: NliteOptions = {};
  let ppr = false;

  const edgeEntryPath = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "adapters",
    "netlify",
    "entry.edge.mjs",
  );

  const environmentPlugin: Plugin = {
    name: "nlite:netlify-edge-environment",
    config(userConfig) {
      ppr = Boolean((userConfig as UserConfig & { nlite?: NliteOptions }).nlite?.ppr);
      if (!ppr) {
        return;
      }

      return {
        environments: {
          [EDGE_ENV]: {
            consumer: "server",
            build: {
              outDir: NETLIFY_EDGE_FUNCTIONS_DIR,
              copyPublicDir: false,
              emitAssets: false,
              rolldownOptions: {
                input: {
                  [EDGE_FUNCTION_NAME]: VIRTUAL_EDGE_ID,
                },
                output: {
                  entryFileNames: `${EDGE_FUNCTION_NAME}.js`,
                  codeSplitting: false,
                },
              },
            },
            resolve: {
              noExternal: true,
            },
          },
        },
      };
    },
  };

  const edgePlugin: Plugin = {
    name: "nlite:netlify-edge",
    applyToEnvironment(environment) {
      return environment.name === EDGE_ENV;
    },
    resolveId(id) {
      if (id === VIRTUAL_EDGE_ID) {
        return RESOLVED_VIRTUAL_EDGE_ID;
      }
      return;
    },
    load(id) {
      if (id !== RESOLVED_VIRTUAL_EDGE_ID) {
        return;
      }

      return `import handler from ${JSON.stringify(edgeEntryPath)};

export default handler;

export const config = {
  name: "nlite ppr",
  generator: ${JSON.stringify(getGeneratorString())},
  path: "/*",
  excludedPath: [
    "/_nlite/*",
    "/.netlify/*",
    "/*.meta",
  ],
};
`;
    },
  };

  const adapterPlugin: Plugin = {
    name: "nlite:netlify",
    apply: "build",
    enforce: "post",
    applyToEnvironment(environment) {
      return environment.name === "api" || environment.name === EDGE_ENV;
    },
    configResolved(resolvedConfig) {
      config = resolvedConfig;
      nliteOptions = (resolvedConfig as unknown as { nlite?: NliteOptions }).nlite ?? {};
      ppr = Boolean(nliteOptions.ppr);
    },
    buildApp: {
      async handler(builder) {
        if (!ppr) {
          return;
        }

        const edgeEnvironment = builder.environments[EDGE_ENV];
        if (!edgeEnvironment) {
          throw new Error("[nlite] Netlify edge environment was not configured for PPR.");
        }

        rmSync(path.join(builder.config.root, NETLIFY_OUTPUT_DIR), {
          recursive: true,
          force: true,
        });

        await builder.build(edgeEnvironment);
      },
    },
    async closeBundle() {
      // Edge env also triggers closeBundle; only finalize once from the api build.
      if (this.environment.name !== "api") {
        return;
      }

      const root = config.root;
      const serverOutDir = path.resolve(root, config.environments.rsc.build.outDir);

      if (!(await exists(serverOutDir))) {
        config.logger.warn("[nlite] Netlify adapter skipped: server bundle was not found.");
        return;
      }

      const clientOutDir = path.resolve(root, config.environments.client.build.outDir);

      // Drop stale edge outputs.
      if (!ppr) {
        rmSync(path.join(root, NETLIFY_EDGE_FUNCTIONS_DIR), {
          recursive: true,
          force: true,
        });
      }

      await Promise.all([
        writeNetlifyFunction(root, serverOutDir),
        writeNetlifyConfig(root, ppr),
        writeNetlifyToml(root, config.logger),
        fixRootRscAsset(clientOutDir),
      ]);

      config.logger.info(`[nlite] Netlify build ready.`);
    },
  };

  return [environmentPlugin, edgePlugin, adapterPlugin];
}

async function fixRootRscAsset(publishDir: string) {
  const dotRscPath = path.join(publishDir, RSC_POSTFIX);

  if (!(await exists(dotRscPath))) {
    return;
  }

  await fs.rename(dotRscPath, path.join(publishDir, ROOT_RSC_ALIAS));
  await writeNetlifyRedirects(publishDir);
}

async function writeNetlifyRedirects(publishDir: string) {
  const redirectsPath = path.join(publishDir, "_redirects");
  const generated = [`${REDIRECTS_GENERATED_MARKER}`, `/.rsc /_rsc 200`, ""].join("\n");

  if (!(await exists(redirectsPath))) {
    await fs.writeFile(redirectsPath, generated);
    return;
  }

  const existing = await fs.readFile(redirectsPath, "utf8");
  const withoutGenerated = stripGeneratedRedirectsSection(existing);

  await fs.writeFile(
    redirectsPath,
    withoutGenerated ? `${withoutGenerated.trimEnd()}\n\n${generated}` : generated,
  );
}

function stripGeneratedRedirectsSection(content: string) {
  const markerIndex = content.indexOf(REDIRECTS_GENERATED_MARKER);

  if (markerIndex === -1) {
    return content;
  }

  return content.slice(0, markerIndex).trimEnd();
}

async function writeNetlifyFunction(root: string, serverOutDir: string) {
  const functionsDir = path.join(root, NETLIFY_FUNCTIONS_DIR);
  const functionDir = path.join(functionsDir, FUNCTION_NAME);
  const functionPath = path.join(functionDir, "index.js");
  const serverImportPath = `./${FUNCTION_SERVER_DIR}/index.js`;

  await fs.rm(functionsDir, { recursive: true, force: true });
  await fs.mkdir(functionDir, { recursive: true });
  await copyDir(serverOutDir, path.join(functionDir, FUNCTION_SERVER_DIR));
  await fs.writeFile(
    functionPath,
    `${buildFunctionSource(serverImportPath, getGeneratorString())}\n`,
  );
}

function buildFunctionSource(serverImportPath: string, generator: string) {
  return `import { handler } from "${serverImportPath}";

const ASSETS = {
  fetch,
};

const ORIGIN_URL_HEADER = ${JSON.stringify(ORIGIN_URL_HEADER)};

function restoreOriginRequest(request) {
  const originPathname = request.headers.get(ORIGIN_URL_HEADER);
  if (!originPathname) {
    return request;
  }
  const url = new URL(request.url);
  url.pathname = originPathname;

  return new Request(url, request);
}

export default async (request, _env) =>
  handler(restoreOriginRequest(request), { ..._env, ASSETS });

export const config = {
  name: "nlite server",
  generator: ${JSON.stringify(generator)},
  path: ["/*", ${JSON.stringify(ORIGIN_PATH)}],
  preferStatic: true,
  excludedPath: ["/*.meta", "/*.html"], // TODO: need revisit here, check entry.edge.ts:57
  includedFiles: [${JSON.stringify(`${NETLIFY_FUNCTIONS_DIR}/${FUNCTION_NAME}/**`)}],
};
`;
}

async function writeNetlifyConfig(root: string, ppr: boolean) {
  const configPath = path.join(root, ".netlify/v1/config.json");
  const payload: Record<string, unknown> = {
    functions: {
      directory: NETLIFY_FUNCTIONS_DIR,
      included_files: [`${NETLIFY_FUNCTIONS_DIR}/${FUNCTION_NAME}/**`],
    },
  };

  if (ppr) {
    payload.edge_functions = [
      {
        function: EDGE_FUNCTION_NAME,
        path: "/*",
        excludedPath: ["/_nlite/*", "/.netlify/*", "/*.meta"],
      },
    ];
  }

  await fs.mkdir(path.dirname(configPath), { recursive: true });
  await fs.writeFile(configPath, `${JSON.stringify(payload, null, 2)}\n`);
}

async function copyDir(source: string, destination: string) {
  if (!(await exists(source))) {
    return;
  }

  await fs.rm(destination, { recursive: true, force: true });
  await fs.cp(source, destination, { recursive: true, force: true });
}

async function writeNetlifyToml(root: string, logger: Logger) {
  const tomlPath = path.join(root, "netlify.toml");

  if (await exists(tomlPath)) {
    const content = await fs.readFile(tomlPath, "utf8");
    const { content: updated, changed } = mergeNetlifyToml(content);

    if (!changed) {
      return;
    }

    logger.info(`[nlite] Updated netlify.toml.`);

    await fs.writeFile(tomlPath, updated.endsWith("\n") ? updated : `${updated}\n`);
    return;
  }

  await fs.writeFile(
    tomlPath,
    `[build]\n  command = ${JSON.stringify("nlite build")}\n  publish = ${JSON.stringify(".nlite/client")}\n`,
  );
  logger.info(`[nlite] Created netlify.toml`);
}

function mergeNetlifyToml(content: string) {
  const lines = content.split(/\r?\n/);
  const buildIndex = lines.findIndex((line) => /^\s*\[build\]\s*(?:#.*)?$/.test(line));
  const command = "nlite build";
  const publish = ".nlite/client";

  if (buildIndex === -1) {
    const separator =
      content.length > 0 && !content.endsWith("\n\n")
        ? content.endsWith("\n")
          ? "\n"
          : "\n\n"
        : "";
    return {
      content: `${content}${separator}[build]\n  command = ${JSON.stringify(command)}\n  publish = ${JSON.stringify(publish)}\n`,
      changed: true,
    };
  }

  let sectionEnd = buildIndex + 1;
  while (sectionEnd < lines.length) {
    if (/^\s*\[[^\]]+\]\s*(?:#.*)?$/.test(lines[sectionEnd]!)) {
      break;
    }
    sectionEnd++;
  }

  const commandLine = `  command = ${JSON.stringify(command)}`;
  const publishLine = `  publish = ${JSON.stringify(publish)}`;
  const commandPattern = /^\s*command\s*=\s*(['"]?)([^'"\n#]*)\1?\s*(?:#.*)?$/;
  const publishPattern = /^\s*publish\s*=\s*(['"]?)([^'"\n#]*)\1?\s*(?:#.*)?$/;

  let commandIndex = -1;
  let publishIndex = -1;
  let previousCommand: string | undefined;
  let previousPublish: string | undefined;
  let commandChanged = false;
  let publishChanged = false;

  for (let index = buildIndex + 1; index < sectionEnd; index++) {
    const commandMatch = commandPattern.exec(lines[index]!);
    if (commandMatch) {
      commandIndex = index;
      previousCommand = commandMatch[2]?.trim();
      if (previousCommand !== command) {
        lines[index] = commandLine;
        commandChanged = true;
      }
      continue;
    }

    const publishMatch = publishPattern.exec(lines[index]!);
    if (publishMatch) {
      publishIndex = index;
      previousPublish = publishMatch[2]?.trim();
      if (previousPublish !== publish) {
        lines[index] = publishLine;
        publishChanged = true;
      }
    }
  }

  if (commandIndex === -1) {
    const insertIndex = publishIndex === -1 ? buildIndex + 1 : publishIndex;
    lines.splice(insertIndex, 0, commandLine);
    commandIndex = insertIndex;
    if (publishIndex !== -1 && insertIndex <= publishIndex) {
      publishIndex += 1;
    }
    commandChanged = true;
  }

  if (publishIndex === -1) {
    lines.splice(commandIndex + 1, 0, publishLine);
    publishChanged = true;
  }

  if (!commandChanged && !publishChanged) {
    return { content, changed: false, previousCommand, previousPublish };
  }

  return { content: lines.join("\n"), changed: true, previousCommand, previousPublish };
}

function getGeneratorString() {
  const require = createRequire(import.meta.url);
  const packageJsonPath = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "../package.json",
  );
  const { version } = require(packageJsonPath) as { version: string };
  return `nlite@${version}`;
}

async function exists(filePath: string) {
  const [_, error] = await tryCatch(fs.access(filePath));
  if (error) {
    return false;
  }
  return true;
}
