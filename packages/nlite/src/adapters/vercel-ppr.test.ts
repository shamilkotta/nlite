import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  collectPartiallyStaticRoutes,
  getPostponedStateContentType,
  removeStaticPprArtifacts,
  routePathFromMetaRelative,
  toVercelPrerenderPath,
  writePprPrerender,
} from "./vercel-ppr.js";

// Multi-byte char makes string.length !== Buffer.byteLength (CDN uses bytes).
const META = JSON.stringify({
  renderingMode: "PARTIALLY_STATIC",
  postponed: { nav: "Doppelgänger" },
  cache: null,
});
const HTML = "<!doctype html><html><body>shell</body></html>";

describe("vercel PPR helpers", () => {
  it("maps route paths to Vercel prerender pathnames", () => {
    expect(toVercelPrerenderPath("/")).toBe("index");
    expect(toVercelPrerenderPath("/about")).toBe("about");
    expect(toVercelPrerenderPath("/blog/post")).toBe("blog/post");
  });

  it("maps meta relative paths back to route paths", () => {
    expect(routePathFromMetaRelative("index.meta")).toBe("/");
    expect(routePathFromMetaRelative("about.meta")).toBe("/about");
    expect(routePathFromMetaRelative("blog/post.meta")).toBe("/blog/post");
  });

  it("declares state-length in UTF-8 bytes", () => {
    const contentType = getPostponedStateContentType(META);
    const match = contentType.match(
      /^application\/x-nextjs-pre-render; state-length=(\d+); origin=(".*")$/,
    );
    expect(match).not.toBeNull();
    expect(Number(match![1])).toBe(Buffer.byteLength(META));
    expect(Buffer.byteLength(META)).toBeGreaterThan(META.length);
    expect(JSON.parse(match![2]!)).toBe("text/html; charset=utf-8");
  });
});

describe("writePprPrerender", () => {
  let root: string;
  let staticDir: string;
  let functionsDir: string;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), "nlite-vercel-ppr-"));
    staticDir = path.join(root, "static");
    functionsDir = path.join(root, "functions");
    await fs.mkdir(staticDir, { recursive: true });
    await fs.mkdir(path.join(functionsDir, "__nlite.func"), { recursive: true });
    await fs.writeFile(path.join(functionsDir, "__nlite.func", "index.js"), "export default {};\n");
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  async function seedRoute(routeFileBase: string) {
    const dir = path.join(staticDir, path.dirname(routeFileBase));
    await fs.mkdir(dir, { recursive: true });
    const base = path.basename(routeFileBase);
    await fs.writeFile(path.join(dir, `${base}.meta`), META);
    await fs.writeFile(path.join(dir, `${base}.html`), HTML);
  }

  it("collects PARTIALLY_STATIC routes and skips STATIC", async () => {
    await seedRoute("index");
    await fs.writeFile(
      path.join(staticDir, "about.meta"),
      JSON.stringify({ renderingMode: "STATIC" }),
    );
    await fs.writeFile(path.join(staticDir, "about.html"), HTML);

    const routes = await collectPartiallyStaticRoutes(staticDir);
    expect(routes.map((r) => r.routePath)).toEqual(["/"]);
  });

  it("emits prepended fallback, chain config, and function symlink", async () => {
    await seedRoute("blog/post");
    const [route] = await collectPartiallyStaticRoutes(staticDir);
    expect(route).toBeDefined();

    const written = await writePprPrerender({
      functionsDir,
      parentFunctionName: "__nlite",
      route: route!,
      groupId: 1,
      expiration: false,
    });

    expect(written.prerenderPath).toBe("blog/post");
    expect(written.stateLength).toBe(Buffer.byteLength(META));

    const fallback = await fs.readFile(written.fallbackPath);
    expect(fallback.subarray(0, written.stateLength).toString("utf8")).toBe(META);
    expect(fallback.subarray(written.stateLength).toString("utf8")).toBe(HTML);

    const config = JSON.parse(await fs.readFile(written.configPath, "utf8")) as {
      expiration: false;
      fallback: string;
      chain: { headers: { "next-resume": string }; outputPath: string };
      initialHeaders: { "content-type": string };
    };

    expect(config.expiration).toBe(false);
    expect(config.fallback).toBe("post.prerender-fallback.html");
    expect(config.chain.headers["next-resume"]).toBe("1");
    expect(config.chain.outputPath).toBe("./blog/post");
    expect(config.initialHeaders["content-type"]).toContain(`state-length=${written.stateLength}`);

    const funcTarget = await fs.readlink(path.join(functionsDir, "blog/post.func"));
    expect(path.resolve(path.join(functionsDir, "blog"), funcTarget)).toBe(
      path.resolve(functionsDir, "__nlite.func"),
    );

    await removeStaticPprArtifacts(staticDir, route!);
    await expect(fs.access(path.join(staticDir, "blog/post.html"))).rejects.toThrow();
    await expect(fs.access(path.join(staticDir, "blog/post.meta"))).rejects.toThrow();
  });

  it("emits index prerender for the root route", async () => {
    await seedRoute("index");
    const [route] = await collectPartiallyStaticRoutes(staticDir);

    const written = await writePprPrerender({
      functionsDir,
      parentFunctionName: "__nlite",
      route: route!,
      groupId: 1,
    });

    expect(written.prerenderPath).toBe("index");
    expect(await fs.access(path.join(functionsDir, "index.prerender-config.json"))).toBeUndefined();
    expect(
      await fs.access(path.join(functionsDir, "index.prerender-fallback.html")),
    ).toBeUndefined();
  });
});
