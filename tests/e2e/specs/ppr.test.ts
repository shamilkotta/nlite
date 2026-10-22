import { describe, expect, it } from "vitest";

import {
  clientOutputExists,
  readClientOutput,
  readJsonOutput,
  useFixture,
} from "../harness/fixture.js";
import { useBrowser } from "../harness/browser.js";
import { hasId, textById } from "../harness/html.js";
import { html } from "../harness/render.js";
import { useUpstream } from "../harness/upstream.js";

const FIXTURE = "ppr";

interface PprMeta {
  renderingMode: "STATIC" | "PARTIALLY_STATIC";
  postponed?: unknown;
  cache?: { data: Record<string, unknown>; fetch: Record<string, unknown> };
}

describe("partial prerendering", () => {
  const upstream = useUpstream();
  const app = useFixture(FIXTURE, "preview", () => ({ env: { UPSTREAM_URL: upstream.url } }));
  const browser = useBrowser();

  describe("build output", () => {
    it("marks a route with a dynamic Suspense boundary as partially static", () => {
      const meta = readJsonOutput<PprMeta>(FIXTURE, "index.meta");
      expect(meta.renderingMode).toBe("PARTIALLY_STATIC");
      expect(meta.postponed).toBeTruthy();
    });

    it("prerenders the static shell with the Suspense fallback in place of the hole", () => {
      const shell = readClientOutput(FIXTURE, "index.html");
      expect(textById(shell, "heading")).toBe("PPR home");
      expect(textById(shell, "shell-id")).toBeTruthy();
      expect(textById(shell, "fallback")).toBe("Loading greeting");
      expect(hasId(shell, "hole-user")).toBe(false);
    });

    it("does not write a static RSC payload for a partially static route", () => {
      expect(clientOutputExists(FIXTURE, ".rsc")).toBe(false);
      expect(clientOutputExists(FIXTURE, "cache.rsc")).toBe(false);
    });

    it("keeps a route without request APIs fully static", () => {
      const meta = readJsonOutput<PprMeta>(FIXTURE, "static.meta");
      expect(meta.renderingMode).toBe("STATIC");
      expect(meta.postponed).toBeUndefined();
      expect(clientOutputExists(FIXTURE, "static.rsc")).toBe(true);
    });

    it("treats loading.tsx as the boundary that becomes the hole", () => {
      const meta = readJsonOutput<PprMeta>(FIXTURE, "loading-boundary.meta");
      expect(meta.renderingMode).toBe("PARTIALLY_STATIC");
      const shell = readClientOutput(FIXTURE, "loading-boundary.html");
      expect(textById(shell, "loading")).toBe("Loading segment");
      expect(hasId(shell, "tag")).toBe(false);
    });

    it("stores 'use cache' results from the shell render in the route meta", () => {
      const meta = readJsonOutput<PprMeta>(FIXTURE, "cache.meta");
      const keys = Object.keys(meta.cache?.data ?? {});
      expect(keys.some((key) => key.endsWith(':["shared"]'))).toBe(true);
      expect(keys.some((key) => key.endsWith(':["hole-only"]'))).toBe(false);
    });

    it("stores force-cache fetch responses from the shell render in the route meta", () => {
      const meta = readJsonOutput<PprMeta>(FIXTURE, "fetch.meta");
      expect(Object.keys(meta.cache?.fetch ?? {})).toHaveLength(1);
    });
  });

  describe("serving", () => {
    it("streams the prerendered shell followed by the resumed hole", async () => {
      const response = await app.fetch("/", { headers: { cookie: "user=ada" } });
      expect(response.status).toBe(200);
      const body = await html(response);

      const shellId = textById(readClientOutput(FIXTURE, "index.html"), "shell-id");
      expect(textById(body, "shell-id")).toBe(shellId);
      expect(textById(body, "hole-user")).toBe("ada");
      expect(body.indexOf('id="shell-id"')).toBeLessThan(body.indexOf('id="hole-user"'));
    });

    it("reuses the shell but resumes the hole for every request", async () => {
      const [first, second] = await Promise.all([
        app.fetch("/", { headers: { cookie: "user=first" } }).then(html),
        app.fetch("/", { headers: { cookie: "user=second" } }).then(html),
      ]);

      expect(textById(first, "shell-id")).toBe(textById(second, "shell-id"));
      expect(textById(first, "hole-user")).toBe("first");
      expect(textById(second, "hole-user")).toBe("second");
      expect(textById(first, "hole-id")).not.toBe(textById(second, "hole-id"));
    });

    it("serves a fully static route in a PPR app without resuming", async () => {
      const builtId = textById(readClientOutput(FIXTURE, "static.html"), "render-id");
      const response = await app.fetch("/static");
      expect(response.headers.get("content-length")).toBe(
        String(Buffer.byteLength(readClientOutput(FIXTURE, "static.html"))),
      );
      expect(textById(await response.text(), "render-id")).toBe(builtId);
    });

    it("renders a page that reads request data outside Suspense entirely per request", async () => {
      const first = await html(await app.fetch("/no-suspense", { headers: { cookie: "user=ada" } }));
      const second = await html(await app.fetch("/no-suspense"));
      expect(textById(first, "user")).toBe("ada");
      expect(textById(second, "user")).toBe("anonymous");
      expect(textById(first, "render-id")).not.toBe(textById(second, "render-id"));
    });

    it("resumes a loading.tsx boundary with the request's data", async () => {
      const body = await html(
        await app.fetch("/loading-boundary", { headers: { "x-e2e-tag": "resumed" } }),
      );
      expect(textById(body, "tag")).toBe("resumed");
    });

    it("resumes every hole of a page with several boundaries", async () => {
      const body = await html(
        await app.fetch("/multiple-holes", {
          headers: { cookie: "user=ada", "x-e2e-tag": "blue" },
        }),
      );
      expect(textById(body, "between")).toBe("static between holes");
      expect(textById(body, "from-cookie")).toBe("ada");
      expect(textById(body, "from-header")).toBe("blue");
    });

    it("renders the RSC payload of a partially static route on demand", async () => {
      const response = await app.fetch("/.rsc", { headers: { cookie: "user=payload-user" } });
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("text/x-component;charset=utf-8");
      expect(response.headers.get("x-nlite-staletime")).toBe("0");
      expect(await response.text()).toContain("payload-user");
    });

    it("answers HEAD for a partially static route without a body", async () => {
      const response = await app.fetch("/", { method: "HEAD" });
      expect(response.status).toBe(200);
      expect(await response.text()).toBe("");
    });
  });

  describe('"use cache"', () => {
    it("reuses the build-time result when the hole calls the same function with the same args", async () => {
      const shellValue = textById(readClientOutput(FIXTURE, "cache.html"), "shell-shared");
      const body = await html(await app.fetch("/cache"));

      expect(textById(body, "shell-shared")).toBe(shellValue);
      expect(textById(body, "hole-shared")).toBe(shellValue);
    });

    it("computes values the shell never asked for at request time", async () => {
      const first = textById(await html(await app.fetch("/cache")), "hole-only");
      const second = textById(await html(await app.fetch("/cache")), "hole-only");
      expect(first).toMatch(/^hole-only:/);
      expect(first).not.toBe(second);
    });
  });

  describe("fetch()", () => {
    it("serves force-cache responses from the build cache, in the shell and in the hole", async () => {
      const hitsAfterBuild = upstream.hits("/ppr-shell");
      expect(hitsAfterBuild).toBeGreaterThanOrEqual(1);

      const body = await html(await app.fetch("/fetch"));
      await app.fetch("/fetch").then(html);

      expect(textById(body, "shell-cached")).toBe(String(hitsAfterBuild));
      expect(textById(body, "hole-cached")).toBe(String(hitsAfterBuild));
      expect(upstream.hits("/ppr-shell")).toBe(hitsAfterBuild);
    });

    it("calls the upstream for uncached fetches in the hole on every request", async () => {
      const before = upstream.hits("/ppr-live");
      const first = textById(await html(await app.fetch("/fetch")), "hole-live");
      const second = textById(await html(await app.fetch("/fetch")), "hole-live");
      expect(Number(first)).toBe(before + 1);
      expect(Number(second)).toBe(before + 2);
    });
  });

  describe("in the browser", () => {
    it("replaces the fallback with the resumed content", async () => {
      const { page } = await browser.open(app.url("/interactive"), {
        cookies: { user: "browser" },
      });

      await page.locator("#hole-user").waitFor();
      expect(await page.locator("#hole-user").textContent()).toBe("browser");
      expect(await page.locator("#fallback").count()).toBe(0);
    });

    it("hydrates the shell without mismatches and keeps its build-time content", async () => {
      const builtId = textById(readClientOutput(FIXTURE, "interactive.html"), "build-id");
      const { page, errors } = await browser.open(app.url("/interactive"));

      await page.locator("#counter").click();
      await page.locator("#counter", { hasText: "count:1" }).waitFor();
      expect(await page.locator("#build-id").textContent()).toBe(builtId);
      expect(errors, errors.join("\n")).toEqual([]);
    });
  });

  describe("resume protocol", () => {
    it("ignores a forged resume request with an invalid body", async () => {
      const response = await app.fetch("/", {
        method: "POST",
        headers: { "x-nlite-resume": "1" },
        body: "not json",
      });
      expect(response.status).toBe(204);
      expect(await response.text()).toBe("");
    });

    it("ignores a forged resume request without postponed state", async () => {
      const response = await app.fetch("/", {
        method: "POST",
        headers: { "x-nlite-resume": "1", "content-type": "application/json" },
        body: JSON.stringify({ cache: { data: {}, fetch: {} } }),
      });
      expect(response.status).toBe(204);
    });

    it("ignores the resume header on GET requests", async () => {
      const response = await app.fetch("/", {
        headers: { "x-nlite-resume": "1", cookie: "user=get-user" },
      });
      expect(response.status).toBe(200);
      expect(textById(await html(response), "hole-user")).toBe("get-user");
    });
  });
});
