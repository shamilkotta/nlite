import { describe, expect, it } from "vitest";

import {
  clientOutputExists,
  readClientOutput,
  readJsonOutput,
  useFixture,
} from "../harness/fixture.js";
import { markWindow, useBrowser, windowMarkerSurvived } from "../harness/browser.js";
import { textById, titleOf } from "../harness/html.js";
import { useUpstream } from "../harness/upstream.js";

const FIXTURE = "ppr-dynamic";

/**
 * Routes that read request data outside any Suspense boundary (and have no loading.tsx) produce
 * an empty PPR shell: nothing has been streamed before the page decides to redirect, call
 * notFound() or throw, so the server is still free to pick the status code.
 */
describe("PPR routes that are fully dynamic (no shell)", () => {
  const upstream = useUpstream();
  const app = useFixture(FIXTURE, "preview", () => ({ env: { UPSTREAM_URL: upstream.url } }));
  const browser = useBrowser();

  describe("build output", () => {
    it("writes an empty shell for a page that reads cookies at the top level", () => {
      expect(readClientOutput(FIXTURE, "cookies-redirect.html")).toBe("");
      const meta = readJsonOutput<{ postponed?: unknown }>(FIXTURE, "cookies-redirect.meta");
      expect(meta.postponed).toBeDefined();
    });

    it("writes an empty shell when only the layout reads cookies", () => {
      expect(readClientOutput(FIXTURE, "guarded.html")).toBe("");
    });

    it("does not prerender a dynamic segment without generateStaticParams", () => {
      expect(clientOutputExists(FIXTURE, "items")).toBe(false);
    });

    it("does not bake the redirect target or 404 into the empty shell", () => {
      for (const file of ["cookies-redirect.html", "cookies-not-found.html", "conditional.html"]) {
        expect(readClientOutput(FIXTURE, file), file).not.toContain("NLITE_");
      }
    });
  });

  describe("redirect() with no shell", () => {
    it("answers 307 with a Location header (cookies at page level)", async () => {
      const response = await app.fetch("/cookies-redirect");
      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe("/target");
    });

    it("answers 307 with a Location header (headers at page level)", async () => {
      const response = await app.fetch("/headers-redirect");
      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe("/target?from=headers");
    });

    it("answers 307 for an external redirect", async () => {
      const response = await app.fetch("/cookies-redirect-external");
      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe("https://example.com/login?next=%2Fdashboard");
    });

    it("answers 307 when a layout redirects", async () => {
      for (const path of ["/guarded", "/guarded/nested"]) {
        const response = await app.fetch(path);
        expect(response.status, path).toBe(307);
        expect(response.headers.get("location"), path).toBe("/target?reason=guard");
      }
    });

    it("answers 307 for HEAD requests", async () => {
      const response = await app.fetch("/cookies-redirect", { method: "HEAD" });
      expect(response.status).toBe(307);
    });

    it("encodes the redirect in the RSC payload", async () => {
      const response = await app.fetch("/cookies-redirect.rsc");
      expect(response.headers.get("content-type")).toMatch(/^text\/x-component/);
      expect(await response.text()).toContain("NLITE_REDIRECT;replace;/target;307;");
    });
  });

  describe("notFound() with no shell", () => {
    it("answers 404 (cookies at page level)", async () => {
      expect((await app.fetch("/cookies-not-found")).status).toBe(404);
    });

    it("answers 404 under a segment with its own not-found.tsx", async () => {
      expect((await app.fetch("/segment/missing")).status).toBe(404);
    });

    it("answers 404 when a layout calls notFound()", async () => {
      expect((await app.fetch("/layout-not-found")).status).toBe(404);
    });

    it("answers 404 for HEAD requests", async () => {
      expect((await app.fetch("/cookies-not-found", { method: "HEAD" })).status).toBe(404);
    });

    it("marks the not-found response noindex", async () => {
      const body = await (await app.fetch("/cookies-not-found")).text();
      expect(body).toMatch(/<meta name="robots" content="noindex"/);
    });

    it("answers 404 to the RSC payload request", async () => {
      const response = await app.fetch("/cookies-not-found.rsc");
      expect(response.status).toBe(404);
      expect(response.headers.get("x-nlite-status")).toBe("404");
    });
  });

  describe("errors with no shell", () => {
    it("answers 500 when the page throws", async () => {
      expect((await app.fetch("/cookies-error")).status).toBe(500);
    });

    it("answers 500 to the RSC payload request", async () => {
      expect((await app.fetch("/cookies-error.rsc")).status).toBe(500);
    });
  });

  describe("uncached fetch at the top level (no shell)", () => {
    it("writes an empty shell", () => {
      expect(readClientOutput(FIXTURE, "fetch-not-found.html")).toBe("");
    });

    it("answers 404 when the fetched data leads to notFound()", async () => {
      expect((await app.fetch("/fetch-not-found")).status).toBe(404);
    });

    it("answers 307 when the fetched data leads to redirect()", async () => {
      const response = await app.fetch("/fetch-redirect");
      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toMatch(/^\/target\?hit=\d+$/);
    });

    it("fetches per request and carries the outcome in the body", async () => {
      const before = upstream.hits("/missing-record");
      const body = await (await app.fetch("/fetch-not-found")).text();
      expect(upstream.hits("/missing-record")).toBe(before + 1);
      expect(body).toContain("NLITE_NOT_FOUND;404");
    });
  });

  describe("generateMetadata calling notFound() / redirect()", () => {
    it("renders the page and title when metadata resolves", async () => {
      const response = await app.fetch("/meta-param/1");
      expect(response.status).toBe(200);
      const body = await response.text();
      expect(textById(body, "meta-param")).toBe("Item 1");
      expect(titleOf(body)).toBe("Item 1");
    });

    it("answers 404 when generateMetadata calls notFound()", async () => {
      expect((await app.fetch("/meta-param/2")).status).toBe(404);
    });

    it("answers 307 when generateMetadata calls redirect()", async () => {
      const response = await app.fetch("/meta-param/old");
      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe("/meta-param/1");
    });

    it("does not leak a server stack trace in the error response", async () => {
      const body = await (await app.fetch("/meta-param/2")).text();
      expect(body).not.toContain("at createNotFoundError");
      expect(body).not.toContain(".nlite/server");
    });
  });

  describe("decided by request data", () => {
    it("redirects anonymous visitors with 307", async () => {
      const response = await app.fetch("/conditional");
      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe("/target?reason=login");
    });

    it("answers 404 when the cookie says so", async () => {
      const response = await app.fetch("/conditional", { headers: { cookie: "session=banned" } });
      expect(response.status).toBe(404);
    });

    it("renders the page with 200 when allowed", async () => {
      const response = await app.fetch("/conditional", { headers: { cookie: "session=ada" } });
      expect(response.status).toBe(200);
      expect(textById(await response.text(), "welcome")).toBe("Welcome ada");
    });

    it("renders guarded layout content with a session", async () => {
      const response = await app.fetch("/guarded", { headers: { cookie: "session=x" } });
      expect(response.status).toBe(200);
      expect(textById(await response.text(), "guarded")).toBe("Guarded content");
    });

    it("renders a layout-gated page when the header is present", async () => {
      const response = await app.fetch("/layout-not-found", { headers: { "x-feature": "on" } });
      expect(response.status).toBe(200);
      expect(textById(await response.text(), "feature")).toBe("Feature page");
    });

    it("never answers 304 for one user's response to another user", async () => {
      const first = await app.fetch("/conditional", { headers: { cookie: "session=ada" } });
      const etag = first.headers.get("etag");
      await first.text();
      const second = await app.fetch("/conditional", {
        headers: { cookie: "session=bob", ...(etag ? { "if-none-match": etag } : {}) },
      });
      expect(second.status).toBe(200);
      expect(textById(await second.text(), "welcome")).toBe("Welcome bob");
    });
  });

  describe("dynamic segment without a shell file", () => {
    it("answers 307 for redirect()", async () => {
      const response = await app.fetch("/items/old");
      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe("/items/1");
    });

    it("answers 404 for notFound()", async () => {
      expect((await app.fetch("/items/2")).status).toBe(404);
    });

    it("answers 200 for a valid param", async () => {
      const response = await app.fetch("/items/1", { headers: { cookie: "user=ada" } });
      expect(response.status).toBe(200);
      expect(textById(await response.text(), "item")).toBe("Item 1 for ada");
    });

    it("answers 404 to the RSC payload request for notFound()", async () => {
      const response = await app.fetch("/items/2.rsc");
      expect(response.status).toBe(404);
    });
  });

  describe('rendering = "force-ssr" with ppr enabled', () => {
    it("answers 307 for redirect()", async () => {
      const response = await app.fetch("/force-ssr-redirect");
      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe("/target");
    });

    it("answers 404 for notFound()", async () => {
      expect((await app.fetch("/force-ssr-not-found")).status).toBe(404);
    });
  });

  // Contrast: once a shell exists the status line has already been sent, so 200 is expected.
  describe("with a shell (loading.tsx or Suspense)", () => {
    it("answers 200 with the loading UI, then redirects in the stream", async () => {
      const response = await app.fetch("/with-loading/redirect");
      expect(response.status).toBe(200);
      const body = await response.text();
      expect(textById(body, "loading")).toBe("Loading");
      expect(body).toContain("NLITE_REDIRECT;replace;/target;307;");
    });

    it("answers 200 with the loading UI, then not-found in the stream", async () => {
      const response = await app.fetch("/with-loading/not-found");
      expect(response.status).toBe(200);
      expect(await response.text()).toContain("NLITE_NOT_FOUND;404");
    });

    it("answers 200 with the shell when a Suspense hole redirects", async () => {
      const response = await app.fetch("/hole-redirect");
      expect(response.status).toBe(200);
      const body = await response.text();
      expect(textById(body, "shell")).toBe("Shell");
      expect(body).toContain("NLITE_REDIRECT;replace;/target;307;");
    });

    it("answers 200 with the shell when a Suspense hole calls notFound()", async () => {
      const response = await app.fetch("/hole-not-found");
      expect(response.status).toBe(200);
      expect(textById(await response.text(), "shell")).toBe("Shell");
    });
  });

  describe("static pages under ppr", () => {
    it("prerenders a static redirect as a document", () => {
      expect(readClientOutput(FIXTURE, "static-redirect.html")).toContain(
        "NLITE_REDIRECT;replace;/target;307;",
      );
    });

    it("answers 404 for a static page that calls notFound()", async () => {
      expect((await app.fetch("/static-not-found")).status).toBe(404);
    });
  });

  describe("in the browser", () => {
    it("lands on the target after loading a no-shell redirect page", async () => {
      const { page } = await browser.open(app.url("/cookies-redirect"));
      await page.waitForURL(app.url("/target"));
      await page.locator("#target").waitFor();
    });

    it("lands on the target when a layout redirects", async () => {
      const { page } = await browser.open(app.url("/guarded/nested"));
      await page.waitForURL(app.url("/target?reason=guard"));
      await page.locator("#target").waitFor();
    });

    it("shows the not-found UI for a no-shell notFound()", async () => {
      const { page } = await browser.open(app.url("/cookies-not-found"));
      await page.locator("#root-not-found").waitFor();
    });

    it("shows the segment not-found UI", async () => {
      const { page } = await browser.open(app.url("/segment/missing"));
      await page.locator("#segment-not-found").waitFor();
    });

    it("shows the error UI when the page throws", async () => {
      const { page } = await browser.open(app.url("/cookies-error"));
      await page.locator("#root-error").waitFor();
    });

    it("redirects during client navigation without a full reload", async () => {
      const { page } = await browser.open(app.url("/"));
      await markWindow(page);
      await page.locator("#to-cookies-redirect").click();
      await page.waitForURL(app.url("/target"));
      await page.locator("#target").waitFor();
      expect(await windowMarkerSurvived(page)).toBe(true);
    });

    it("redirects from a layout during client navigation", async () => {
      const { page } = await browser.open(app.url("/"));
      await page.locator("#to-guarded").click();
      await page.waitForURL(app.url("/target?reason=guard"));
    });

    it("shows the not-found UI during client navigation", async () => {
      const { page } = await browser.open(app.url("/"));
      await page.locator("#to-cookies-not-found").click();
      await page.locator("#root-not-found").waitFor();
      expect(new URL(page.url()).pathname).toBe("/cookies-not-found");
    });
  });
});
