import path from "node:path";
import { readFile } from "node:fs/promises";

import mdxRollup from "@mdx-js/rollup";
import matter from "gray-matter";
import { glob } from "tinyglobby";
import type { ModuleNode, Plugin, PluginOption, ResolvedConfig, ViteDevServer } from "vite";

import type {
  CollectionDefinition,
  CollectionRecord,
  CollectionSchemaLike,
  CollectionSourceConfig,
} from "../types.js";
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
      const watchRoots = resolveCollectionWatchRoots(root, options);
      watchContentFiles(server, watchRoots, parseCache);
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
      const collections = options.collections ?? {};

      return await buildContentModule({
        root,
        options,
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
  contentRoots: string[],
  parseCache: Map<string, ParsedContentFile>,
) {
  for (const contentRoot of contentRoots) {
    server.watcher.add(contentRoot);
  }

  const invalidateChangedContent = (file: string) =>
    invalidateContent(server, contentRoots, file, parseCache);

  server.watcher.on("add", invalidateChangedContent);
  server.watcher.on("change", invalidateChangedContent);
  server.watcher.on("unlink", invalidateChangedContent);
  server.watcher.on("addDir", invalidateChangedContent);
  server.watcher.on("unlinkDir", invalidateChangedContent);
}

function invalidateContent(
  server: ViteDevServer,
  contentRoots: string[],
  file: string,
  parseCache: Map<string, ParsedContentFile>,
) {
  const isWithinContentRoots = contentRoots.some((contentRoot) => {
    const relative = path.relative(contentRoot, file);
    return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
  });

  if (!isWithinContentRoots) {
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
  root,
  options,
  collections,
  parseCache,
}: {
  root: string;
  options: NliteMdxOptions;
  collections: CollectionRecord;
  parseCache: Map<string, ParsedContentFile>;
}) {
  const lines: string[] = ["export const collections = {"];

  for (const [collectionName, definition] of Object.entries(collections)) {
    const files = await resolveCollectionFiles({
      root,
      options,
      collectionName,
      definition,
    });
    const entries: string[] = [];

    for (const file of files.sort()) {
      const parsed = await readParsedContentFile(file, parseCache);
      const id = path.basename(file).replace(/\.(md|mdx)$/u, "");
      const frontmatter = parsed.frontmatter;
      const slug =
        typeof frontmatter.slug === "string" && frontmatter.slug.length > 0 ? frontmatter.slug : id;
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

function resolveCollectionWatchRoots(root: string, options: NliteMdxOptions): string[] {
  const collections = options.collections ?? {};
  const roots = new Set<string>();

  for (const [collectionName, definition] of Object.entries(collections)) {
    for (const watchRoot of getCollectionWatchRoots(
      root,
      getContentDir(options),
      collectionName,
      definition,
    )) {
      roots.add(watchRoot);
    }
  }

  if (roots.size === 0) {
    roots.add(path.resolve(root, getContentDir(options)));
  }

  return [...roots];
}

function getCollectionWatchRoots(
  root: string,
  contentDir: string,
  collectionName: string,
  definition: CollectionDefinition<unknown>,
) {
  const source = definition.source;

  if (!source) {
    return [path.resolve(root, contentDir, collectionName)];
  }

  if (Array.isArray(source)) {
    return source.map((pattern) => getWatchRootFromPattern(root, pattern));
  }

  if (typeof source === "string") {
    return [getWatchRootFromPattern(root, source)];
  }

  return [path.resolve(root, source.cwd)];
}

function getWatchRootFromPattern(root: string, pattern: string) {
  const wildcardIndex = pattern.search(/[*{[]/u);
  const base = wildcardIndex === -1 ? pattern : pattern.slice(0, wildcardIndex);
  return path.resolve(root, base || ".");
}

async function resolveCollectionFiles({
  root,
  options,
  collectionName,
  definition,
}: {
  root: string;
  options: NliteMdxOptions;
  collectionName: string;
  definition: CollectionDefinition<unknown>;
}) {
  const source = definition.source;

  if (!source) {
    return await glob("**/*.{md,mdx}", {
      cwd: path.resolve(root, getContentDir(options), collectionName),
      absolute: true,
      onlyFiles: true,
    });
  }

  if (Array.isArray(source)) {
    const results = await Promise.all(
      source.map((pattern) =>
        glob(pattern, {
          cwd: root,
          absolute: true,
          onlyFiles: true,
        }),
      ),
    );
    return uniqueSortedFiles(results.flat());
  }

  if (typeof source === "string") {
    return uniqueSortedFiles(
      await glob(source, {
        cwd: root,
        absolute: true,
        onlyFiles: true,
      }),
    );
  }

  return await resolveSourceConfigFiles(root, source);
}

async function resolveSourceConfigFiles(root: string, source: CollectionSourceConfig) {
  const include = source.include
    ? Array.isArray(source.include)
      ? source.include
      : [source.include]
    : ["**/*.{md,mdx}"];
  const ignore = source.exclude
    ? Array.isArray(source.exclude)
      ? source.exclude
      : [source.exclude]
    : [];

  const files = await Promise.all(
    include.map((pattern) =>
      glob(pattern, {
        cwd: path.resolve(root, source.cwd),
        absolute: true,
        onlyFiles: true,
        ignore,
      }),
    ),
  );
  return uniqueSortedFiles(files.flat());
}

function uniqueSortedFiles(files: string[]) {
  return [...new Set(files)].sort();
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
