import path from "node:path";
import { readFile } from "node:fs/promises";

import mdxRollup from "@mdx-js/rollup";
import matter from "gray-matter";
import { glob } from "tinyglobby";
import type { ModuleNode, Plugin, PluginOption, ResolvedConfig, ViteDevServer } from "vite";

import type { CollectionDefinition, CollectionRecord, CollectionSchemaLike } from "../types.js";
import { toPosix } from "../utils/fs-routes.js";

const VIRTUAL_CONTENT_ID = "virtual:nlite/content";
const RESOLVED_CONTENT_ID = `\0${VIRTUAL_CONTENT_ID}`;
const CONTENT_QUERY = "nlite-mdx-content";

interface ModuleGraphLike {
  getModuleById(id: string): ModuleNode | undefined;
  invalidateModule(mod: ModuleNode): void;
}

export interface NliteMdxOptions {
  contentDir?: string;
  collections?: CollectionRecord;
}

interface ParsedContentFile {
  frontmatter: Record<string, unknown>;
  body: string;
}

export function mdx(options: NliteMdxOptions = {}): PluginOption[] {
  let resolvedConfig: ResolvedConfig | undefined;
  const parseCache = new Map<string, ParsedContentFile>();

  const contentPlugin: Plugin = {
    name: "nlite:mdx",
    applyToEnvironment(environment) {
      return environment.name !== "api";
    },
    configResolved(config) {
      resolvedConfig = config;
    },
    configureServer(server) {
      const root = resolvedConfig?.root ?? server.config.root;
      const contentDir = getContentDir(options);
      const contentRoot = path.resolve(root, contentDir);
      watchContentFiles(server, contentRoot, parseCache);
    },
    resolveId(id) {
      if (id === RESOLVED_CONTENT_ID) {
        return id;
      }

      if (id === VIRTUAL_CONTENT_ID) {
        return RESOLVED_CONTENT_ID;
      }

      if (id.includes(`?${CONTENT_QUERY}`)) {
        return id;
      }

      return;
    },
    async load(id) {
      if (id.includes(`?${CONTENT_QUERY}`)) {
        const sourcePath = id.slice(0, id.indexOf("?"));
        const parsed = await readParsedContentFile(sourcePath, parseCache);
        return parsed.body;
      }

      if (id !== RESOLVED_CONTENT_ID) {
        return;
      }

      const root = resolvedConfig?.root ?? process.cwd();
      const contentDir = path.resolve(root, getContentDir(options));
      const collections = options.collections ?? {};

      return await buildContentModule({
        contentDir,
        collections,
        parseCache,
      });
    },
  };

  return [
    contentPlugin,
    mdxRollup({
      include: /\.(md|mdx)(\?.*)?$/,
    }),
  ];
}

function getContentDir(options: NliteMdxOptions) {
  return options.contentDir ?? "content";
}

function watchContentFiles(
  server: ViteDevServer,
  contentRoot: string,
  parseCache: Map<string, ParsedContentFile>,
) {
  server.watcher.add(contentRoot);

  const invalidateChangedContent = (file: string) =>
    invalidateContent(server, contentRoot, file, parseCache);

  server.watcher.on("add", invalidateChangedContent);
  server.watcher.on("change", invalidateChangedContent);
  server.watcher.on("unlink", invalidateChangedContent);
  server.watcher.on("addDir", invalidateChangedContent);
  server.watcher.on("unlinkDir", invalidateChangedContent);
}

function invalidateContent(
  server: ViteDevServer,
  contentRoot: string,
  file: string,
  parseCache: Map<string, ParsedContentFile>,
) {
  const relative = path.relative(contentRoot, file);
  const isWithinContentRoot =
    relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));

  if (!isWithinContentRoot) {
    return;
  }

  parseCache.delete(file);
  invalidateVirtualModules(server.moduleGraph);
  invalidateVirtualModulesInAllEnvironments(server);
}

function invalidateVirtualModules(moduleGraph: ModuleGraphLike) {
  const mod = moduleGraph.getModuleById(RESOLVED_CONTENT_ID);
  if (mod) {
    moduleGraph.invalidateModule(mod);
  }
}

function invalidateVirtualModulesInAllEnvironments(server: ViteDevServer) {
  const environments = (server as { environments?: Record<string, unknown> }).environments;

  if (!environments) {
    return;
  }

  for (const environment of Object.values(environments)) {
    const moduleGraph = getEnvironmentModuleGraph(environment);
    if (!moduleGraph) {
      continue;
    }

    invalidateVirtualModules(moduleGraph);
  }
}

function getEnvironmentModuleGraph(environment: unknown): ModuleGraphLike | undefined {
  if (!environment || typeof environment !== "object" || !("moduleGraph" in environment)) {
    return;
  }

  const { moduleGraph } = environment as { moduleGraph?: unknown };

  if (
    !moduleGraph ||
    typeof moduleGraph !== "object" ||
    !("getModuleById" in moduleGraph) ||
    !("invalidateModule" in moduleGraph)
  ) {
    return;
  }

  return moduleGraph as ModuleGraphLike;
}

async function buildContentModule({
  contentDir,
  collections,
  parseCache,
}: {
  contentDir: string;
  collections: CollectionRecord;
  parseCache: Map<string, ParsedContentFile>;
}) {
  const lines: string[] = ["export const collections = {"];

  for (const [collectionName, definition] of Object.entries(collections)) {
    const collectionRoot = path.resolve(contentDir, collectionName);
    const files = await glob("**/*.{md,mdx}", {
      cwd: collectionRoot,
      absolute: true,
      onlyFiles: true,
    });
    const entries: string[] = [];

    for (const file of files.sort()) {
      const parsed = await readParsedContentFile(file, parseCache);
      const id = path.basename(file).replace(/\.(md|mdx)$/u, "");
      const frontmatter = parsed.frontmatter;
      const slug =
        typeof frontmatter.slug === "string" && frontmatter.slug.length > 0
          ? frontmatter.slug
          : id;
      const validatedData = parseCollectionData(definition?.schema, frontmatter, file);
      const serializedData = serializeToModuleValue(validatedData);
      const serializedBody = JSON.stringify(parsed.body);

      entries.push(`{
  id: ${JSON.stringify(id)},
  slug: ${JSON.stringify(slug)},
  body: ${serializedBody},
  data: ${serializedData},
  load: () => import(${JSON.stringify(`${file}?${CONTENT_QUERY}`)})
}`);
    }

    lines.push(`${JSON.stringify(collectionName)}: [${entries.join(",")}],`);
  }

  lines.push("};");
  lines.push("export default collections;");

  return lines.join("\n");
}

async function readParsedContentFile(
  filePath: string,
  parseCache: Map<string, ParsedContentFile>,
): Promise<ParsedContentFile> {
  const cached = parseCache.get(filePath);
  if (cached) {
    return cached;
  }

  const source = await readFile(filePath, "utf8");
  const parsed = matter(source);
  const parsedFile: ParsedContentFile = {
    frontmatter: parsed.data as Record<string, unknown>,
    body: parsed.content,
  };
  parseCache.set(filePath, parsedFile);
  return parsedFile;
}

export function defineCollection<TOutput = unknown>(
  definition: CollectionDefinition<TOutput>,
): CollectionDefinition<TOutput> {
  return definition;
}

function parseCollectionData(
  schema: CollectionSchemaLike | undefined,
  value: unknown,
  filePath: string,
) {
  if (!schema) {
    return value;
  }

  if (typeof schema.parse === "function") {
    try {
      return schema.parse(value);
    } catch (error) {
      throw new Error(`[nlite] Invalid frontmatter in ${toPosix(filePath)}: ${String(error)}`);
    }
  }

  if (typeof schema.safeParse === "function") {
    const result = schema.safeParse(value);
    if (result.success) {
      if ("output" in result) {
        return result.output;
      }
      return result.data;
    }
    throw new Error(`[nlite] Invalid frontmatter in ${toPosix(filePath)}: ${String(result.error)}`);
  }

  return value;
}

function serializeToModuleValue(value: unknown): string {
  if (value instanceof Date) {
    return `new Date(${JSON.stringify(value.toISOString())})`;
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => serializeToModuleValue(item)).join(", ")}]`;
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).map(
      ([key, nestedValue]) => `${JSON.stringify(key)}: ${serializeToModuleValue(nestedValue)}`,
    );
    return `{ ${entries.join(", ")} }`;
  }

  return JSON.stringify(value);
}
