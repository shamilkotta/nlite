import { describe, expect, it } from "vitest";

import { useBrowser } from "../harness/browser.js";
import { textById } from "../harness/html.js";
import { useNetlify } from "../harness/netlify.js";

const FIXTURE = "adapter-netlify";

describe("netlify() with ppr (edge function + serverless function)", () => {
  const app = useNetlify(FIXTURE);
  const browser = useBrowser();

  describe("build output", () => {
    it("writes the frameworks API config with the function and edge function", () => {
      const config = JSON.parse(app.read(".netlify/v1/config.json"));
      expect(config.functions.directory).toBe(".netlify/v1/functions");
      expect(config.edge_functions).toEqual([
        {
          function: "__nlite",
          path: "/*",
          excludedPath: ["/_nlite/*", "/.netlify/*", "/*.meta"],
        },
      ]);
    });

    it("bundles the server into the function", () => {
      expect(app.exists(".netlify/v1/functions/__nlite/index.js")).toBe(true);
      expect(app.exists(".netlify/v1/functions/__nlite/server/index.js")).toBe(true);
      expect(app.exists(".netlify/v1/edge-functions/__nlite.js")).toBe(true);
    });

    it("generates netlify.toml with the build command and publish dir", () => {
      const toml = app.read("netlify.toml");
      expect(toml).toContain('command = "nlite build"');
      expect(toml).toContain('publish = ".nlite/client"');
    });

    it("renames the root .rsc file and rewrites /.rsc to it", () => {
      expect(app.exists(".nlite/client/.rsc")).toBe(false);
      expect(app.exists(".nlite/client/_rsc")).toBe(true);
      expect(app.read(".nlite/client/_redirects")).toContain("/.rsc /_rsc 200");
    });

    it("keeps PPR shells and postponed state in the publish dir", () => {
      expect(app.exists(".nlite/client/partial.html")).toBe(true);
      expect(app.exists(".nlite/client/partial.meta")).toBe(true);
    });
  });

  describe("function invoked directly", () => {
    // The function alone gets the status right; only the edge stitching in front of it hides it.
    it("answers 307 for a no-shell redirect", async () => {
      const response = await app.invoke("/cookies-redirect");
      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe("/target");
    });

    it("answers 404 for a no-shell notFound()", async () => {
      expect((await app.invoke("/cookies-not-found")).status).toBe(404);
    });

    it("restores the original path from x-nlite-origin-url", async () => {
      const response = await app.invoke("/.netlify/functions/__nlite", {
        headers: { "x-nlite-origin-url": "/ssr", "x-e2e": "origin" },
      });
      expect(textById(await response.text(), "ssr")).toBe("origin");
    });
  });

  describe("static and partial pages", () => {
    it("serves static pages", async () => {
      const response = await app.fetch("/static");
      expect(response.status).toBe(200);
      expect(textById(await response.text(), "static")).toBe("Static page");
    });

    it("serves the root RSC payload through the /.rsc rewrite", async () => {
      const response = await app.fetch("/.rsc");
      expect(response.status).toBe(200);
      expect(await response.text()).toContain("Home");
    });

    it("stitches the shell with the resumed hole", async () => {
      const response = await app.fetch("/partial", { headers: { cookie: "user=ada" } });
      expect(response.status).toBe(200);
      expect(response.headers.get("x-nlite-staletime")).toBe("0");
      const body = await response.text();
      expect(textById(body, "shell")).toBe("Partial shell");
      expect(textById(body, "user")).toBe("ada");
    });

    it("resumes the RSC payload", async () => {
      const response = await app.fetch("/partial.rsc", { headers: { cookie: "user=ada" } });
      expect(response.status).toBe(200);
      expect(await response.text()).toContain("ada");
    });

    it("renders force-ssr pages in the function", async () => {
      const response = await app.fetch("/ssr", { headers: { "x-e2e": "netlify" } });
      expect(textById(await response.text(), "ssr")).toBe("netlify");
    });

    it("serves route handlers", async () => {
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
    });

    it("does not publicly serve the postponed state (.meta)", async () => {
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

    it("renders the not-found UI for notFound() instead of an empty body", async () => {
      expect(await (await app.fetch("/cookies-not-found")).text()).toContain("NLITE_NOT_FOUND");
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
      await page.locator("#root-not-found").waitFor({ timeout: 3000 });
    });
  });

  describe("dynamic segment (no shell file)", () => {
    it("answers 307 for redirect() and 404 for notFound()", async () => {
      const redirect = await app.fetch("/items/old");
      expect(redirect.status).toBe(307);
      expect(redirect.headers.get("location")).toBe("/items/1");
      expect((await app.fetch("/items/2")).status).toBe(404);
    });
  });

  describe("static pages", () => {
    it("answers 404 for a static page that calls notFound()", async () => {
      expect((await app.fetch("/static-not-found")).status).toBe(404);
    });
  });
});
