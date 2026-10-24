import { describe, expect, it } from "vitest";

import { useBrowser } from "../harness/browser.js";
import { textById } from "../harness/html.js";
import { useVercel } from "../harness/vercel.js";

const FIXTURE = "adapter-vercel";

interface PrerenderConfig {
  initialStatus: number;
  initialHeaders: Record<string, string>;
  initialMetadata?: { htmlSize: number };
  fallback: string;
  chain: { headers: Record<string, string>; outputPath: string };
}

describe("vercel() with ppr (Build Output API)", () => {
  const app = useVercel(FIXTURE);
  const browser = useBrowser();

  describe("build output", () => {
    it("writes config.json v3 with the expected route order", () => {
      const config = app.readJson<{ version: number; routes: Array<Record<string, any>> }>(
        "config.json",
      );
      expect(config.version).toBe(3);
      expect(config.routes[0]).toMatchObject({ src: "/(.*)/$", status: 308 });
      expect(config.routes.some((entry) => entry.handle === "filesystem")).toBe(true);
      expect(config.routes.at(-1)).toMatchObject({ src: "/(.*)", dest: "/__nlite" });
    });

    it("writes a streaming Node.js function", () => {
      const vc = app.readJson("functions/__nlite.func/.vc-config.json");
      expect(vc).toMatchObject({
        handler: "index.js",
        launcherType: "Nodejs",
        supportsResponseStreaming: true,
      });
      expect(vc.runtime).toMatch(/^nodejs/);
      expect(app.outputExists("functions/__nlite.func/server/index.js")).toBe(true);
    });

    it("copies static pages to static/", () => {
      for (const file of ["static.html", "static.rsc", "target.html", "_not-found.html"]) {
        expect(app.outputExists(`static/${file}`), file).toBe(true);
      }
    });

    it("moves PPR routes from static/ to prerender functions", () => {
      expect(app.outputExists("static/partial.html")).toBe(false);
      expect(app.outputExists("static/partial.meta")).toBe(false);
      expect(app.outputExists("functions/partial.prerender-config.json")).toBe(true);
      expect(app.outputExists("functions/partial.rsc.prerender-config.json")).toBe(true);
      expect(app.outputExists("functions/partial.func")).toBe(true);
    });

    it("chains PPR prerenders to the function with next-resume", () => {
      const config = app.readJson<PrerenderConfig>("functions/partial.prerender-config.json");
      expect(config.chain).toEqual({ headers: { "next-resume": "1" }, outputPath: "partial" });
      expect(config.initialHeaders["content-type"]).toMatch(
        /^application\/x-nextjs-pre-render; state-length=\d+; origin="text\/html; charset=utf-8"$/,
      );
    });

    it("writes nested PPR routes under their directory", () => {
      expect(app.outputExists("functions/guarded/nested.prerender-config.json")).toBe(true);
    });

    it("does not write prerenders for routes rendered on demand", () => {
      expect(app.outputExists("functions/ssr.prerender-config.json")).toBe(false);
      expect(app.outputExists("functions/items")).toBe(false);
    });

    // An empty shell means nothing is sent before the page decides its status, yet the
    // prerender locks the response to 200 before the function runs.
    it("does not lock routes with an empty shell to status 200", () => {
      for (const route of ["cookies-redirect", "cookies-not-found", "cookies-error", "guarded"]) {
        const file = `functions/${route}.prerender-config.json`;
        if (!app.outputExists(file)) continue;
        const config = app.readJson<PrerenderConfig>(file);
        expect(config.initialMetadata?.htmlSize, route).toBe(0);
        expect(config.initialStatus, route).not.toBe(200);
      }
    });
  });

  describe("function invoked directly", () => {
    // The function alone gets the status right; only the prerender in front of it hides it.
    it("answers 307 for a no-shell redirect", async () => {
      const response = await app.invoke("/cookies-redirect");
      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe("/target");
    });

    it("answers 404 for a no-shell notFound()", async () => {
      expect((await app.invoke("/cookies-not-found")).status).toBe(404);
    });

    it("answers 500 for a no-shell error", async () => {
      expect((await app.invoke("/cookies-error")).status).toBe(500);
    });

    it("maps /index to the home page", async () => {
      expect(textById(await (await app.invoke("/index")).text(), "home")).toBe("Home");
    });
  });

  describe("static and partial pages", () => {
    it("serves static pages", async () => {
      const response = await app.fetch("/static");
      expect(response.status).toBe(200);
      expect(textById(await response.text(), "static")).toBe("Static page");
    });

    it("serves the home page", async () => {
      expect(textById(await (await app.fetch("/")).text(), "home")).toBe("Home");
    });

    it("adds the static stale time to .rsc files", async () => {
      const response = await app.fetch("/static.rsc");
      expect(response.headers.get("x-nlite-staletime")).toBe("300");
    });

    it("stitches the shell with the resumed hole", async () => {
      const response = await app.fetch("/partial", { headers: { cookie: "user=ada" } });
      expect(response.status).toBe(200);
      const body = await response.text();
      expect(textById(body, "shell")).toBe("Partial shell");
      expect(textById(body, "user")).toBe("ada");
    });

    it("resumes the RSC payload", async () => {
      const response = await app.fetch("/partial.rsc", { headers: { cookie: "user=ada" } });
      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toContain("no-store");
      expect(await response.text()).toContain("ada");
    });

    it("renders force-ssr pages in the function", async () => {
      const response = await app.fetch("/ssr", { headers: { "x-e2e": "vercel" } });
      expect(response.headers.get("x-nlite-staletime")).toBe("0");
      expect(textById(await response.text(), "ssr")).toBe("vercel");
    });

    it("serves route handlers", async () => {
      expect(await (await app.fetch("/api/echo?q=1")).json()).toEqual({
        path: "/api/echo",
        q: "1",
      });
      const post = await app.fetch("/api/echo", { method: "POST", body: "hi" });
      expect(post.status).toBe(201);
    });

    it("answers 404 with the not-found UI for unknown routes", async () => {
      const response = await app.fetch("/missing");
      expect(response.status).toBe(404);
      expect(textById(await response.text(), "root-not-found")).toBe("Root not found");
    });

    it("redirects trailing slashes with 308", async () => {
      const response = await app.fetch("/static/");
      expect(response.status).toBe(308);
      expect(response.headers.get("location")).toBe("/static");
    });

    it("does not serve the postponed state of PPR routes", async () => {
      expect((await app.fetch("/partial.meta")).status).toBe(404);
    });
  });

  describe("fully dynamic route (empty shell)", () => {
    it("answers 307 + Location for redirect()", async () => {
      const response = await app.fetch("/cookies-redirect");
      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe("/target");
    });

    it("answers 307 when a layout redirects", async () => {
      expect((await app.fetch("/guarded/nested")).status).toBe(307);
    });

    it("answers 404 for notFound()", async () => {
      expect((await app.fetch("/cookies-not-found")).status).toBe(404);
    });

    it("answers 500 when the page throws", async () => {
      expect((await app.fetch("/cookies-error")).status).toBe(500);
    });

    it("answers 404 when request data leads to notFound()", async () => {
      const response = await app.fetch("/conditional", { headers: { cookie: "session=banned" } });
      expect(response.status).toBe(404);
    });

    it("renders the page when allowed", async () => {
      const response = await app.fetch("/conditional", { headers: { cookie: "session=ada" } });
      expect(textById(await response.text(), "welcome")).toBe("Welcome ada");
    });

    it("lands on the target in the browser", async () => {
      const { page } = await browser.open(app.url("/cookies-redirect"));
      await page.waitForURL(app.url("/target"));
      await page.locator("#target").waitFor();
    });

    it("shows the not-found UI in the browser", async () => {
      const { page } = await browser.open(app.url("/cookies-not-found"));
      await page.locator("#root-not-found").waitFor();
    });
  });

  describe("dynamic segment (no prerender)", () => {
    it("answers 307 for redirect() and 404 for notFound()", async () => {
      const redirect = await app.fetch("/items/old");
      expect(redirect.status).toBe(307);
      expect(redirect.headers.get("location")).toBe("/items/1");
      expect((await app.fetch("/items/2")).status).toBe(404);
      expect(textById(await (await app.fetch("/items/1")).text(), "item")).toBe(
        "Item 1 for anonymous",
      );
    });
  });

  describe("static pages", () => {
    it("answers 404 for a static page that calls notFound()", async () => {
      expect((await app.fetch("/static-not-found")).status).toBe(404);
    });
  });
});
