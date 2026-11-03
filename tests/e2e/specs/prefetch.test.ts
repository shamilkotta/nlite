import type { Page } from "playwright";
import { describe, expect, it } from "vitest";

import { clientOutputExists, readClientOutput, useFixture } from "../harness/fixture.js";
import { markWindow, useBrowser, windowMarkerSurvived } from "../harness/browser.js";

const FIXTURE = "prefetch";
const PREFETCH = { "x-nlite-prefetch": "1" };

function waitForPrefetch(page: Page, pathname: string) {
  return page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === `${pathname}.rsc` &&
      response.request().headers()["x-nlite-prefetch"] === "1",
  );
}

function waitForFullRoute(page: Page, pathname: string) {
  return page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === `${pathname}.rsc` &&
      response.request().headers()["x-nlite-prefetch"] === undefined,
  );
}

describe("prefetch shells and instant navigation", () => {
  const app = useFixture(FIXTURE);
  const browser = useBrowser();

  describe("build output", () => {
    it("writes the RSC shell of a PPR route next to its HTML shell", () => {
      const shell = readClientOutput(FIXTURE, "ppr.prefetch.rsc");
      expect(shell).toContain("PPR shell");
      expect(shell).not.toContain("anonymous");
      expect(clientOutputExists(FIXTURE, "ppr.rsc")).toBe(false);
    });

    it("writes only the full payload for a static route", () => {
      expect(clientOutputExists(FIXTURE, "static.rsc")).toBe(true);
      expect(clientOutputExists(FIXTURE, "static.prefetch.rsc")).toBe(false);
    });
  });

  describe("prefetch responses", () => {
    it("serves a static route's full payload", async () => {
      const response = await app.fetch("/static.rsc", { headers: PREFETCH });
      expect(response.headers.get("x-nlite-partial")).toBeNull();
      expect(await response.text()).toContain("Static page");
    });

    it("serves a PPR route's prebuilt shell", async () => {
      const response = await app.fetch("/ppr.rsc", { headers: PREFETCH });
      expect(response.headers.get("x-nlite-partial")).toBe("1");
      const body = await response.text();
      expect(body).toContain("PPR shell");
      expect(body).not.toContain("anonymous");
    });

    it("renders a dynamic route up to its request data", async () => {
      const response = await app.fetch("/dynamic/7.rsc", { headers: PREFETCH });
      expect(response.headers.get("x-nlite-partial")).toBe("1");
      const body = await response.text();
      expect(body).toContain("Dynamic");
      expect(body).toContain("Loading user");
      expect(body).not.toContain("anonymous");
    });

    it("renders the loading UI when the page reads request data at the top", async () => {
      const body = await (await app.fetch("/items/3.rsc", { headers: PREFETCH })).text();
      expect(body).toContain("Loading item");
      expect(body).not.toContain("anonymous");
    });

    it("still serves the full route without the prefetch header", async () => {
      const response = await app.fetch("/dynamic/7.rsc");
      expect(response.headers.get("x-nlite-partial")).toBeNull();
      expect(await response.text()).toContain("anonymous");
    });
  });

  describe("navigation", () => {
    it("navigates to a prefetched static route without another request", async () => {
      const { page, rscRequests } = await browser.open(app.url("/"));
      await page.waitForFunction(() =>
        performance
          .getEntriesByType("resource")
          .some((entry) => entry.name.endsWith("/static.rsc")),
      );
      const before = rscRequests().length;

      await page.locator("#link-static").click();
      await page.locator("#page-static").waitFor();
      expect(rscRequests().length).toBe(before);
    });

    it("shows a PPR route's shell instantly, then streams in the dynamic part", async () => {
      const { page } = await browser.open(app.url("/"));
      await waitForPrefetch(page, "/ppr");
      await markWindow(page);

      const full = waitForFullRoute(page, "/ppr");
      await page.locator("#link-ppr").click();
      await page.locator("#ppr-shell").waitFor({ timeout: 500 });
      await page.locator("#ppr-fallback").waitFor({ timeout: 500 });
      expect(new URL(page.url()).pathname).toBe("/ppr");

      await full;
      await page.locator("#ppr-user", { hasText: "anonymous" }).waitFor();
      expect(await page.locator("#ppr-fallback").count()).toBe(0);
      expect(await windowMarkerSurvived(page)).toBe(true);
    });

    it("shows a dynamic route's shell instantly, then streams in the dynamic part", async () => {
      const { page } = await browser.open(app.url("/"));
      await waitForPrefetch(page, "/dynamic/1");

      await page.locator("#link-dynamic").click();
      await page.locator("#dynamic-shell", { hasText: "Dynamic 1" }).waitFor({ timeout: 500 });
      await page.locator("#dynamic-fallback").waitFor({ timeout: 500 });

      await page.locator("#dynamic-user", { hasText: "anonymous" }).waitFor();
    });

    it("shows loading.tsx instantly for a page that reads request data at the top", async () => {
      const { page } = await browser.open(app.url("/"));
      await waitForPrefetch(page, "/items/1");

      await page.locator("#link-items").click();
      await page.locator("#items-loading").waitFor({ timeout: 500 });

      await page.locator("#items-user", { hasText: "anonymous" }).waitFor();
      expect(await page.locator("#items-loading").count()).toBe(0);
    });

    it("shows loading.tsx again when navigating between params of the same route", async () => {
      const { page } = await browser.open(app.url("/items/1"));
      await page.locator("#items-user").waitFor();

      await page.evaluate(() => {
        (
          globalThis as unknown as {
            __NLITE_NAVIGATION_RUNTIME__: { push(href: string): void };
          }
        ).__NLITE_NAVIGATION_RUNTIME__.push("/items/2");
      });
      await page.locator("#items-loading").waitFor();
      await page.locator("#items-page", { hasText: "Item 2" }).waitFor();
    });

    it("keeps the current page until a route without a shell is ready", async () => {
      const { page } = await browser.open(app.url("/"));
      await waitForPrefetch(page, "/no-shell");

      await page.locator("#link-no-shell").click();
      await page.waitForTimeout(300);
      expect(await page.locator("#page-home").count()).toBe(1);
      expect(new URL(page.url()).pathname).toBe("/");

      await page.locator("#no-shell-user", { hasText: "anonymous" }).waitFor();
      expect(new URL(page.url()).pathname).toBe("/no-shell");
    });

    it("pushes one history entry for the shell and the full route", async () => {
      const { page } = await browser.open(app.url("/"));
      await waitForPrefetch(page, "/ppr");
      const before = await page.evaluate(() => history.length);

      await page.locator("#link-ppr").click();
      await page.locator("#ppr-user").waitFor();
      expect(await page.evaluate(() => history.length)).toBe(before + 1);

      await page.goBack();
      await page.locator("#page-home").waitFor();
    });
  });
});
