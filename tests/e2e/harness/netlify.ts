import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { afterAll, beforeAll } from "vitest";

import { buildFixture, fixtureDir, type BuildResult } from "./fixture.js";
import { CONTENT_TYPES, startWebServer, type WebServer } from "./web-server.js";

/**
 * A small local stand-in for Netlify, driven by the build output:
 * - runs the edge function (`.netlify/v1/edge-functions/__nlite.js`) for paths that its
 *   `config.json` entry matches, with `context.next()` falling through to the origin
 * - origin: `_redirects` rewrites, static files from the publish dir (pretty URLs,
 *   `preferStatic`), then the serverless function unless its `excludedPath` matches
 * - `/.netlify/functions/__nlite` always reaches the function (the edge calls it via fetch)
 *
 * It implements the Netlify semantics the adapter relies on, not all of them.
 */

type FunctionModule = {
  default: (request: Request, context: unknown) => Promise<Response>;
  config: { path: string[]; excludedPath?: string[]; preferStatic?: boolean };
};
type EdgeModule = {
  default: (
    request: Request,
    context: { next(request?: Request): Promise<Response> },
  ) => Promise<Response>;
};
interface EdgeDeclaration {
  function: string;
  path: string;
  excludedPath?: string[];
}

export interface NetlifyEmulator {
  origin: string;
  root: string;
  publishDir: string;
  build: BuildResult;
  url(pathname: string): string;
  fetch(pathname: string, init?: RequestInit): Promise<Response>;
  /** Calls the serverless function directly, bypassing the edge function and static files. */
  invoke(pathname: string, init?: RequestInit): Promise<Response>;
  exists(file: string): boolean;
  read(file: string): string;
}

const FUNCTION_PATH = "/.netlify/functions/__nlite";

/**
 * Netlify edge functions run on Deno, where `new Request(url, { body: stream })` works without
 * `duplex`. Node requires it, so add it for streamed bodies while the emulator is running.
 */
function installDenoRequestShim() {
  const NodeRequest = globalThis.Request;
  class DenoLikeRequest extends NodeRequest {
    constructor(input: RequestInfo | URL, init?: RequestInit) {
      // `init` may itself be a Request (`new Request(url, request)`); spreading one drops its fields.
      const needsDuplex = !(init instanceof NodeRequest) && init?.body instanceof ReadableStream;
      super(input, needsDuplex ? ({ ...init, duplex: "half" } as RequestInit) : init);
    }
  }
  globalThis.Request = DenoLikeRequest as typeof Request;
  return () => {
    globalThis.Request = NodeRequest;
  };
}

export function useNetlify(fixture: string) {
  const state = {} as NetlifyEmulator;
  let server: WebServer | undefined;
  let uninstallShim: (() => void) | undefined;

  beforeAll(async () => {
    uninstallShim = installDenoRequestShim();
    const build = await buildFixture(fixture);
    if (build.code !== 0) throw new Error(`nlite build failed for "${fixture}":\n${build.output}`);

    const root = fixtureDir(fixture);
    const publishDir = path.join(root, ".nlite", "client");
    const config = JSON.parse(readFileSync(path.join(root, ".netlify/v1/config.json"), "utf8")) as {
      edge_functions?: EdgeDeclaration[];
    };
    const stamp = `?t=${Date.now()}`;
    const fn = (await import(
      pathToFileURL(path.join(root, ".netlify/v1/functions/__nlite/index.js")).href + stamp
    )) as FunctionModule;
    const edgeFile = path.join(root, ".netlify/v1/edge-functions/__nlite.js");
    const edge = existsSync(edgeFile)
      ? ((await import(pathToFileURL(edgeFile).href + stamp)) as EdgeModule)
      : undefined;
    const rewrites = readRewrites(publishDir);

    const origin = (request: Request) => serveOrigin(request, publishDir, rewrites, fn);

    server = await startWebServer(async (request) => {
      const { pathname } = new URL(request.url);
      const declaration = config.edge_functions?.find(
        (entry) =>
          matchesPattern(pathname, entry.path) &&
          !entry.excludedPath?.some((pattern) => matchesPattern(pathname, pattern)),
      );
      if (edge && declaration) {
        return edge.default(request, { next: (next) => origin(next ?? request) });
      }
      return origin(request);
    });

    const serverOrigin = server.origin;
    Object.assign(state, {
      origin: serverOrigin,
      root,
      publishDir,
      build,
      url: (pathname: string) => new URL(pathname, serverOrigin).href,
      fetch: (pathname: string, init?: RequestInit) =>
        fetch(new URL(pathname, serverOrigin), { redirect: "manual", ...init }),
      invoke: (pathname: string, init?: RequestInit) =>
        fn.default(new Request(new URL(pathname, serverOrigin), init), {}),
      exists: (file: string) => existsSync(path.join(root, file)),
      read: (file: string) => readFileSync(path.join(root, file), "utf8"),
    } satisfies NetlifyEmulator);
  });

  afterAll(async () => {
    await server?.close();
    uninstallShim?.();
  });

  return state;
}

async function serveOrigin(
  request: Request,
  publishDir: string,
  rewrites: Map<string, string>,
  fn: FunctionModule,
): Promise<Response> {
  const url = new URL(request.url);
  if (url.pathname === FUNCTION_PATH) {
    return fn.default(request, {});
  }

  const rewritten = rewrites.get(url.pathname) ?? url.pathname;
  const file = staticFile(publishDir, rewritten);
  if (file && (request.method === "GET" || request.method === "HEAD")) {
    return new Response(request.method === "HEAD" ? null : readFileSync(file), {
      status: 200,
      headers: { "content-type": CONTENT_TYPES[path.extname(file)] ?? "application/octet-stream" },
    });
  }

  const excluded = fn.config.excludedPath?.some((pattern) => matchesPattern(url.pathname, pattern));
  const routed = fn.config.path.some((pattern) => matchesPattern(url.pathname, pattern));
  if (routed && !excluded) {
    return fn.default(request, {});
  }
  return new Response("Not Found", { status: 404 });
}

function staticFile(publishDir: string, pathname: string) {
  const decoded = decodeURIComponent(pathname);
  const candidates =
    decoded === "/" ? ["index.html"] : [decoded.slice(1), `${decoded.slice(1)}.html`];
  for (const candidate of candidates) {
    const file = path.join(publishDir, candidate);
    if (existsSync(file) && statSync(file).isFile()) return file;
  }
  return undefined;
}

function readRewrites(publishDir: string) {
  const rewrites = new Map<string, string>();
  const file = path.join(publishDir, "_redirects");
  if (!existsSync(file)) return rewrites;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const [from, to, status] = line.trim().split(/\s+/);
    if (!from || from.startsWith("#") || status !== "200") continue;
    rewrites.set(from, to!);
  }
  return rewrites;
}

/** Netlify path patterns: `*` matches anything, including `/`. */
function matchesPattern(pathname: string, pattern: string) {
  const source = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${source}$`).test(pathname);
}
