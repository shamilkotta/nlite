import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { buildFixture, fixtureDir, useFixture } from "../harness/fixture.js";
import { useBrowser } from "../harness/browser.js";
import { textById } from "../harness/html.js";

// `nlite preview` with the cloudflare() adapter runs the built workers in workerd (miniflare).

function readWrangler(fixture: string, dir: "edge" | "server") {
  const file = path.join(fixtureDir(fixture), ".nlite", dir, "wrangler.json");
  return JSON.parse(readFileSync(file, "utf8")) as Record<string, any>;
}

describe("cloudflare() with ppr: two workers (edge + origin)", () => {
  const FIXTURE = "adapter-cloudflare";
  const app = useFixture(FIXTURE);
  const browser = useBrowser();

  describe("build output", () => {
    it("builds an edge worker that keeps the wrangler name and binds the origin", () => {
      const edge = readWrangler(FIXTURE, "edge");
      expect(edge.name).toBe("nlite-e2e-cloudflare");
      expect(edge.services).toEqual([
        { binding: "ORIGIN", service: "nlite-e2e-cloudflare-origin" },
      ]);
      expect(edge.assets).toMatchObject({
        binding: "ASSETS",
        run_worker_first: true,
        directory: "../client",
      });
    });

    it("builds an origin worker with smart placement and no public URL", () => {
      const origin = readWrangler(FIXTURE, "server");
      expect(origin.name).toBe("nlite-e2e-cloudflare-origin");
      expect(origin.placement).toEqual({ mode: "smart" });
      expect(origin.workers_dev).toBe(false);
      expect(origin.compatibility_flags).toContain("nodejs_compat");
    });

    it("writes an _headers file with RSC stale times", () => {
      const headers = readFileSync(
        path.join(fixtureDir(FIXTURE), ".nlite", "client", "_headers"),
        "utf8",
      );
      expect(headers).toContain("/*.rsc\n  x-nlite-staletime: 300");
      expect(headers).toContain("/_not-found.rsc\n  x-nlite-staletime: 0");
    });
  });

  describe("static and partial pages", () => {
    it("serves static pages from assets", async () => {
      const response = await app.fetch("/static");
      expect(response.status).toBe(200);
      expect(textById(await response.text(), "static")).toBe("Static page");
    });

    it("stitches the static shell with the resumed hole", async () => {
      const response = await app.fetch("/partial", { headers: { cookie: "user=ada" } });
      expect(response.status).toBe(200);
      expect(response.headers.get("x-nlite-staletime")).toBe("0");
      const body = await response.text();
      expect(textById(body, "shell")).toBe("Partial shell");
      expect(textById(body, "user")).toBe("ada");
    });

    it("resumes the RSC payload for a partial page", async () => {
      const response = await app.fetch("/partial.rsc", { headers: { cookie: "user=ada" } });
      expect(response.status).toBe(200);
      expect(await response.text()).toContain("ada");
    });

    it("renders force-ssr pages on the origin", async () => {
      const response = await app.fetch("/ssr", { headers: { "x-e2e": "cloudflare" } });
      expect(textById(await response.text(), "ssr")).toBe("cloudflare");
    });

    it("serves route handlers (GET and POST)", async () => {
      expect(await (await app.fetch("/api/echo?q=1")).json()).toEqual({
        path: "/api/echo",
        q: "1",
      });
      const post = await app.fetch("/api/echo", { method: "POST", body: "hi" });
      expect(post.status).toBe(201);
      expect(await post.json()).toEqual({ body: "hi" });
    });

    it("answers 404 with the not-found UI for unknown routes", async () => {
      const response = await app.fetch("/missing");
      expect(response.status).toBe(404);
      expect(textById(await response.text(), "root-not-found")).toBe("Root not found");
      expect((await app.fetch("/missing.rsc")).status).toBe(404);
    });

    it("redirects trailing-slash URLs", async () => {
      const response = await app.fetch("/static/");
      expect([301, 307, 308]).toContain(response.status);
      expect(response.headers.get("location")).toBe("/static");
    });

    it("does not publicly serve the postponed state (.meta)", async () => {
      expect((await app.fetch("/cookies-redirect.meta")).status).toBe(404);
    });
  });

  // Route reads cookies at the top level, no loading.tsx: the shell is empty, so the edge
  // worker could still answer with the origin's status.
  describe("fully dynamic route (empty shell)", () => {
    it("answers 307 + Location for redirect()", async () => {
      const response = await app.fetch("/cookies-redirect");
      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe("/target");
    });

    it("answers 307 when a layout redirects", async () => {
      const response = await app.fetch("/guarded/nested");
      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe("/target?reason=guard");
    });

    it("answers 307 for HEAD", async () => {
      expect((await app.fetch("/cookies-redirect", { method: "HEAD" })).status).toBe(307);
    });

    it("answers 404 for notFound()", async () => {
      expect((await app.fetch("/cookies-not-found")).status).toBe(404);
    });

    it("renders the not-found UI for notFound()", async () => {
      const body = await (await app.fetch("/cookies-not-found")).text();
      expect(body).toContain("NLITE_NOT_FOUND");
    });

    it("answers 500 when the page throws", async () => {
      const response = await app.fetch("/cookies-error");
      expect(response.status).toBe(500);
    });

    it("renders something for a thrown error instead of an empty body", async () => {
      expect((await (await app.fetch("/cookies-error")).text()).length).toBeGreaterThan(0);
    });

    it("answers 404 when request data leads to notFound()", async () => {
      const response = await app.fetch("/conditional", { headers: { cookie: "session=banned" } });
      expect(response.status).toBe(404);
    });

    it("renders the page with the request's cookies when allowed", async () => {
      const response = await app.fetch("/conditional", { headers: { cookie: "session=ada" } });
      expect(response.status).toBe(200);
      expect(textById(await response.text(), "welcome")).toBe("Welcome ada");
    });

    it("encodes redirect and not-found in the RSC payload", async () => {
      expect(await (await app.fetch("/cookies-redirect.rsc")).text()).toContain(
        "NLITE_REDIRECT;replace;/target;307;",
      );
      expect(await (await app.fetch("/cookies-not-found.rsc")).text()).toContain(
        "NLITE_NOT_FOUND;404",
      );
    });

    it("lands on the target in the browser", async () => {
      const { page } = await browser.open(app.url("/cookies-redirect"));
      await page.waitForURL(app.url("/target"));
      await page.locator("#target").waitFor();
    });

    it("shows the not-found UI in the browser", async () => {
      const { page } = await browser.open(app.url("/cookies-not-found"));
      await page.locator("#root-not-found").waitFor({ timeout: 3000 });
    });
  });

  describe("dynamic segment with no prerendered shell", () => {
    it("answers 307 for redirect()", async () => {
      const response = await app.fetch("/items/old");
      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe("/items/1");
    });

    it("answers 404 for notFound()", async () => {
      expect((await app.fetch("/items/2")).status).toBe(404);
    });
  });

  describe("route with a shell (Suspense or loading.tsx)", () => {
    it("answers 200 and redirects inside the stream", async () => {
      for (const route of ["/hole-redirect", "/with-loading/redirect"]) {
        const response = await app.fetch(route);
        expect(response.status, route).toBe(200);
        expect(await response.text(), route).toContain("NLITE_REDIRECT;replace;/target;307;");
      }
    });
  });

  describe("static pages", () => {
    it("answers 404 for a static page that calls notFound()", async () => {
      expect((await app.fetch("/static-not-found")).status).toBe(404);
    });
  });
});

describe("cloudflare() without ppr: single worker", () => {
  const FIXTURE = "adapter-cloudflare-ssr";
  const app = useFixture(FIXTURE);

  it("builds one worker that keeps the wrangler name", () => {
    const worker = readWrangler(FIXTURE, "server");
    expect(worker.name).toBe("nlite-e2e-cloudflare-ssr");
    expect(worker.assets).toMatchObject({ binding: "ASSETS", directory: "../client" });
    expect(existsSync(path.join(fixtureDir(FIXTURE), ".nlite", "edge"))).toBe(false);
  });

  it("serves static pages and renders Suspense content per request", async () => {
    expect((await app.fetch("/static")).status).toBe(200);
    const body = await (await app.fetch("/partial", { headers: { cookie: "user=ada" } })).text();
    expect(textById(body, "user")).toBe("ada");
  });

  it("answers 307 + Location for a page that reads cookies and redirects", async () => {
    const response = await app.fetch("/cookies-redirect");
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("/target");
  });

  it("answers 307 when a layout redirects", async () => {
    const response = await app.fetch("/guarded");
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("/target?reason=guard");
  });

  it("answers 307 for HEAD", async () => {
    expect((await app.fetch("/cookies-redirect", { method: "HEAD" })).status).toBe(307);
  });

  it("answers 404 for notFound()", async () => {
    expect((await app.fetch("/cookies-not-found")).status).toBe(404);
    expect(
      (await app.fetch("/conditional", { headers: { cookie: "session=banned" } })).status,
    ).toBe(404);
    expect((await app.fetch("/items/2")).status).toBe(404);
  });

  it("answers 500 when the page throws", async () => {
    expect((await app.fetch("/cookies-error")).status).toBe(500);
  });

  it("serves route handlers", async () => {
    expect(await (await app.fetch("/api/echo?q=2")).json()).toEqual({ path: "/api/echo", q: "2" });
  });

  it("answers 404 for unknown routes", async () => {
    expect((await app.fetch("/missing")).status).toBe(404);
  });
});

describe("cloudflare() with ppr but no wrangler config", () => {
  it("fails the build with a clear message", async () => {
    const result = await buildFixture("adapter-cloudflare-no-wrangler");
    expect(result.code).not.toBe(0);
    expect(result.output).toContain(
      "PPR on Cloudflare requires a wrangler.json, wrangler.jsonc, or wrangler.toml",
    );
  });
});
