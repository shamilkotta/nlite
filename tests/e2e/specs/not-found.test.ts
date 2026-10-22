import { describe, expect, it } from "vitest";

import { useBrowser } from "../harness/browser.js";
import { clientOutputExists, readClientOutput, useFixture } from "../harness/fixture.js";
import { hasId, metaContent, textById, titleOf, withoutFlight } from "../harness/html.js";
import { html } from "../harness/render.js";

const FIXTURE = "not-found";

describe("not found", () => {
  describe("with a custom root not-found.tsx", () => {
    const app = useFixture(FIXTURE);

    it("prerenders the global not-found page with the custom UI", () => {
      expect(clientOutputExists(FIXTURE, "_not-found.html")).toBe(true);
      expect(textById(readClientOutput(FIXTURE, "_not-found.html"), "root-not-found")).toBe(
        "Root not found page",
      );
    });

    it("responds 404 with the custom page inside the root layout for an unknown URL", async () => {
      const response = await app.fetch("/does/not/exist");
      expect(response.status).toBe(404);
      const body = withoutFlight(await html(response));
      expect(body).toMatch(/<div id="root-layout"><p id="root-not-found">/);
    });

    it("responds 404 when a page calls notFound()", async () => {
      expect((await app.fetch("/shop/sandal")).status).toBe(404);
      expect((await app.fetch("/blog/missing-post")).status).toBe(404);
    });

    it("renders the matching page when notFound() is not called", async () => {
      const response = await app.fetch("/shop/boot");
      expect(response.status).toBe(200);
      expect(textById(await response.text(), "item")).toBe("boot");
    });

    // Known issue: when notFound() is thrown, SSR falls back to an empty document and the
    // not-found.tsx UI only appears after hydration, so it is missing without JavaScript.
    it.fails("includes the segment's not-found.tsx in the server HTML", async () => {
      const body = withoutFlight(await html(await app.fetch("/shop/sandal")));
      expect(textById(body, "shop-not-found")).toBe("This product does not exist");
    });

    it("marks notFound() responses as noindex", async () => {
      const body = await html(await app.fetch("/blog/missing-post"));
      expect(metaContent(body, "robots")).toBe("noindex");
      expect(titleOf(body)).toBe("404: This page could not be found");
    });

    it("responds 404 to an unknown RSC payload request", async () => {
      const response = await app.fetch("/does-not-exist.rsc");
      expect(response.status).toBe(404);
      expect(response.headers.get("content-type")).toBe("text/x-component;charset=utf-8");
      expect(response.headers.get("x-nlite-status")).toBe("404");
      expect(await response.text()).toContain("root-not-found");
    });

    it("returns an empty 404 when the client does not accept HTML", async () => {
      const response = await app.fetch("/does-not-exist", {
        headers: { accept: "application/json" },
      });
      expect(response.status).toBe(404);
      expect(await response.text()).toBe("");
    });

    it("returns an empty 404 for missing files", async () => {
      for (const path of ["/missing.png", "/favicon.ico", "/nested/style.css"]) {
        const response = await app.fetch(path);
        expect(response.status, path).toBe(404);
        expect(await response.text(), path).toBe("");
      }
    });

    it("returns an empty 404 for non-GET requests to unknown URLs", async () => {
      const response = await app.fetch("/does-not-exist", { method: "POST", body: "x" });
      expect(response.status).toBe(404);
      expect(await response.text()).toBe("");
    });

    // Known issue: the preview server serves `_not-found.html` for `/_not-found` like any
    // other prerendered page, so the internal route answers 200.
    it.fails("does not expose the internal not-found route", async () => {
      const response = await app.fetch("/_not-found");
      expect(response.status).toBe(404);
    });

    it("prerenders a static page that calls notFound() as a not-found document", () => {
      const built = readClientOutput(FIXTURE, "static-missing.html");
      expect(titleOf(built)).toBe("404: This page could not be found");
      expect(metaContent(built, "robots")).toBe("noindex");
    });

    // Known bug: the prerendered not-found document is served as a regular static file,
    // so a static page that calls notFound() answers 200 instead of 404.
    it.fails("responds 404 for a static page that calls notFound()", async () => {
      const response = await app.fetch("/static-missing");
      expect(response.status).toBe(404);
    });

    describe("in the browser", () => {
      const browser = useBrowser();

      it("renders the nearest segment not-found.tsx inside the segment layout", async () => {
        const { page } = await browser.open(app.url("/shop/sandal"));
        await page.locator("#shop-layout #shop-not-found").waitFor();
        expect(await page.locator("#root-not-found").count()).toBe(0);
      });

      // Known issue: hydration re-renders the document head from the route's metadata, so the
      // "404" title from the server response is replaced with the route's (empty) title.
      it.fails("keeps the 404 title after hydration", async () => {
        const { page } = await browser.open(app.url("/shop/sandal"));
        await page.locator("#shop-not-found").waitFor();
        expect(await page.title()).toBe("404: This page could not be found");
      });

      it("falls back to the root not-found.tsx when the segment has none", async () => {
        const { page } = await browser.open(app.url("/blog/missing-post"));
        await page.locator("#root-layout #root-not-found").waitFor();
      });

      it("shows the not-found UI for an unknown URL", async () => {
        const { page } = await browser.open(app.url("/nope"));
        await page.locator("#root-not-found").waitFor();
      });
    });
  });

  describe("without a not-found.tsx", () => {
    const app = useFixture("not-found-default");

    it("renders the built-in 404 UI inside the root layout", async () => {
      const response = await app.fetch("/missing");
      expect(response.status).toBe(404);
      const body = withoutFlight(await html(response));
      expect(body).toContain('<div id="root-layout">');
      expect(body).toContain("This page could not be found.");
      expect(body).toMatch(/<h1 class="_nlite_status___code">404<\/h1>/);
    });
  });
});
