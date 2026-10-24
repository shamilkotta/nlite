import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { afterAll, beforeAll } from "vitest";

import { buildFixture, fixtureDir, type BuildResult } from "./fixture.js";
import { CONTENT_TYPES, startWebServer, type WebServer } from "./web-server.js";

/**
 * A small local stand-in for the Vercel edge network, driven only by `.vercel/output`:
 * - applies `config.json` routes (status/headers/continue/dest+check/handle: filesystem)
 * - serves `static/` files
 * - serves PPR prerenders: `initialStatus` + `initialHeaders` + the shell from the fallback
 *   file, then chains a `next-resume` request to the function and streams its body
 * - invokes the real function (`functions/__nlite.func/index.js`) with web `Request`s
 *
 * It implements the Build Output API semantics the adapter relies on, not all of them.
 */

interface Route {
  src?: string;
  dest?: string;
  status?: number;
  headers?: Record<string, string>;
  continue?: boolean;
  check?: boolean;
  handle?: string;
}

interface PrerenderConfig {
  initialStatus?: number;
  initialHeaders?: Record<string, string>;
  fallback: string;
  chain?: { headers: Record<string, string>; outputPath: string };
}

type FunctionHandler = { fetch(request: Request, env: unknown): Promise<Response> };

export interface VercelEmulator {
  origin: string;
  outputDir: string;
  build: BuildResult;
  url(pathname: string): string;
  fetch(pathname: string, init?: RequestInit): Promise<Response>;
  /** Calls the function directly, bypassing routes and prerenders. */
  invoke(pathname: string, init?: RequestInit): Promise<Response>;
  readOutput(file: string): string;
  outputExists(file: string): boolean;
  readJson<T = Record<string, any>>(file: string): T;
}

export function useVercel(fixture: string) {
  const state = {} as VercelEmulator;
  let server: WebServer | undefined;

  beforeAll(async () => {
    const build = await buildFixture(fixture);
    if (build.code !== 0) throw new Error(`nlite build failed for "${fixture}":\n${build.output}`);

    const outputDir = path.join(fixtureDir(fixture), ".vercel", "output");
    const config = JSON.parse(readFileSync(path.join(outputDir, "config.json"), "utf8")) as {
      routes: Route[];
    };
    const fnModule = (await import(
      `${pathToFileURL(path.join(outputDir, "functions", "__nlite.func", "index.js")).href}?t=${Date.now()}`
    )) as { default: FunctionHandler };

    server = await startWebServer((request) =>
      route(request, config.routes, outputDir, fnModule.default),
    );
    const origin = server.origin;

    Object.assign(state, {
      origin,
      outputDir,
      build,
      url: (pathname: string) => new URL(pathname, origin).href,
      fetch: (pathname: string, init?: RequestInit) =>
        fetch(new URL(pathname, origin), { redirect: "manual", ...init }),
      invoke: (pathname: string, init?: RequestInit) =>
        fnModule.default.fetch(new Request(new URL(pathname, origin), init), {}),
      readOutput: (file: string) => readFileSync(path.join(outputDir, file), "utf8"),
      outputExists: (file: string) => existsSync(path.join(outputDir, file)),
      readJson: (file: string) => JSON.parse(readFileSync(path.join(outputDir, file), "utf8")),
    } satisfies VercelEmulator);
  });

  afterAll(async () => {
    await server?.close();
  });

  return state;
}

async function route(
  request: Request,
  routes: Route[],
  outputDir: string,
  fn: FunctionHandler,
): Promise<Response> {
  const url = new URL(request.url);
  let pathname = url.pathname;
  const headers = new Headers();

  for (const entry of routes) {
    if (entry.handle === "filesystem") {
      const found = serveFilesystem(pathname, request, outputDir, fn);
      if (found) return withHeaders(await found, headers);
      continue;
    }
    if (!entry.src) continue;

    const match = new RegExp(`^${entry.src}$`).exec(pathname);
    if (!match) continue;
    const substitute = (value: string) =>
      value.replace(/\$(\d+)/g, (_, i) => match[Number(i)] ?? "");

    for (const [name, value] of Object.entries(entry.headers ?? {})) {
      headers.set(name, substitute(value));
    }
    if (entry.status) {
      return new Response(null, { status: entry.status, headers });
    }
    if (entry.dest) {
      const destination = substitute(entry.dest);
      if (entry.check) {
        const found = serveFilesystem(destination, request, outputDir, fn);
        if (found) return withHeaders(await found, headers);
        continue;
      }
      if (destination === "/__nlite") {
        return withHeaders(await fn.fetch(request, {}), headers);
      }
      pathname = destination;
    }
    if (!entry.continue) break;
  }

  return new Response("Not Found", { status: 404, headers });
}

function serveFilesystem(
  pathname: string,
  request: Request,
  outputDir: string,
  fn: FunctionHandler,
): Promise<Response> | undefined {
  const relative = decodeURIComponent(pathname === "/" ? "/index" : pathname).slice(1);

  const prerenderConfig = path.join(outputDir, "functions", `${relative}.prerender-config.json`);
  if (existsSync(prerenderConfig)) {
    return servePrerender(request, prerenderConfig, fn);
  }

  for (const candidate of [relative, pathname === "/" ? "index.html" : undefined]) {
    if (!candidate) continue;
    const file = path.join(outputDir, "static", candidate);
    if (existsSync(file) && statSync(file).isFile()) {
      const type = CONTENT_TYPES[path.extname(file)] ?? "application/octet-stream";
      return Promise.resolve(
        new Response(request.method === "HEAD" ? null : readFileSync(file), {
          status: 200,
          headers: { "content-type": type },
        }),
      );
    }
  }
  return undefined;
}

async function servePrerender(request: Request, configPath: string, fn: FunctionHandler) {
  const config = JSON.parse(readFileSync(configPath, "utf8")) as PrerenderConfig;
  const fallback = readFileSync(path.join(path.dirname(configPath), config.fallback));
  const initialHeaders = { ...config.initialHeaders };
  const contentType = initialHeaders["content-type"] ?? "";
  const stateLength = Number(/state-length=(\d+)/.exec(contentType)?.[1] ?? 0);
  const originType = /origin="([^"]+)"/.exec(contentType)?.[1];
  if (originType) initialHeaders["content-type"] = originType;

  const postponed = fallback.subarray(0, stateLength);
  const shell = fallback.subarray(stateLength);

  const resumeHeaders = new Headers(request.headers);
  for (const [name, value] of Object.entries(config.chain?.headers ?? {})) {
    resumeHeaders.set(name, value);
  }
  const resume = fn.fetch(
    new Request(request.url, { method: "POST", headers: resumeHeaders, body: postponed }),
    {},
  );

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(new Uint8Array(shell));
      const response = await resume;
      if (response.body) {
        const reader = response.body.getReader();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          controller.enqueue(value);
        }
      }
      controller.close();
    },
  });

  return new Response(request.method === "HEAD" ? null : body, {
    status: config.initialStatus ?? 200,
    headers: initialHeaders,
  });
}

function withHeaders(response: Response, extra: Headers) {
  if ([...extra.keys()].length === 0) return response;
  const headers = new Headers(response.headers);
  extra.forEach((value, name) => headers.set(name, value));
  return new Response(response.body, { status: response.status, headers });
}
