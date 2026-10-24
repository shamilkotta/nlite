import { describe, expect, it } from "vitest";

import { useFixture } from "../harness/fixture.js";
import { markWindow, useBrowser, windowMarkerSurvived } from "../harness/browser.js";

const FIXTURE = "navigation";

describe("client navigation (Link and useRouter)", () => {
  const app = useFixture(FIXTURE);
  const browser = useBrowser();

  describe("Link", () => {
    it("navigates without a full page load", async () => {
      const { page, rscRequests } = await browser.open(app.url("/"));
      await markWindow(page);

      await page.locator("#link-b").click();
      await page.locator("#page-b").waitFor();

      expect(new URL(page.url()).pathname).toBe("/b");
      expect(await windowMarkerSurvived(page)).toBe(true);
      expect(rscRequests()).toContain("/b.rsc");
    });

    it("keeps layout state across navigations", async () => {
      const { page } = await browser.open(app.url("/"));
      await page.locator("#layout-counter").click();
      await page.locator("#layout-counter", { hasText: "layout:1" }).waitFor();

      await page.locator("#link-b").click();
      await page.locator("#page-b").waitFor();

      expect(await page.locator("#layout-counter").textContent()).toBe("layout:1");
    });

    it("updates usePathname() and useSearchParams()", async () => {
      const { page } = await browser.open(app.url("/"));
      await page.locator("#link-query").click();
      await page.locator("#page-a").waitFor();
      await page.locator("#current-path", { hasText: "/a?tab=details" }).waitFor();
    });

    it("restores the previous page on back and the next page on forward", async () => {
      const { page } = await browser.open(app.url("/"));
      await markWindow(page);
      await page.locator("#link-b").click();
      await page.locator("#page-b").waitFor();

      await page.goBack();
      await page.locator("#page-home").waitFor();
      expect(new URL(page.url()).pathname).toBe("/");

      await page.goForward();
      await page.locator("#page-b").waitFor();
      expect(await windowMarkerSurvived(page)).toBe(true);
    });

    it("pushes a history entry by default", async () => {
      const { page } = await browser.open(app.url("/"));
      const before = await page.evaluate(() => history.length);
      await page.locator("#link-b").click();
      await page.locator("#page-b").waitFor();
      expect(await page.evaluate(() => history.length)).toBe(before + 1);
    });

    it("replaces the history entry with replace", async () => {
      const { page } = await browser.open(app.url("/"));
      const before = await page.evaluate(() => history.length);
      await page.locator("#link-a-replace").click();
      await page.locator("#page-a").waitFor();
      expect(await page.evaluate(() => history.length)).toBe(before);
    });

    it("shows the not-found UI for an unknown route", async () => {
      const { page } = await browser.open(app.url("/"));
      await page.locator("#link-missing").click();
      await page.getByText("This page could not be found.").waitFor();
      expect(new URL(page.url()).pathname).toBe("/does-not-exist");
    });

    it("scrolls to the target of a same-page hash link without fetching", async () => {
      const { page, rscRequests } = await browser.open(app.url("/"));
      await page.locator("#link-hash").click();
      await page.waitForURL(app.url("/#section"));
      expect(rscRequests()).toEqual(expect.not.arrayContaining(["/.rsc"]));
    });

    it("scrolls to the top after navigating", async () => {
      const { page } = await browser.open(app.url("/scroll"));
      await page.locator("#scroll-to-a").scrollIntoViewIfNeeded();
      expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
      await page.locator("#scroll-to-a").click();
      await page.locator("#page-a").waitFor();
      await page.waitForFunction(() => window.scrollY === 0);
    });

    it("keeps the scroll position with scroll={false}", async () => {
      const { page } = await browser.open(app.url("/scroll"));
      await page.locator("#keep-scroll-to-tall").scrollIntoViewIfNeeded();
      const scrolled = await page.evaluate(() => window.scrollY);
      expect(scrolled).toBeGreaterThan(0);
      await page.locator("#keep-scroll-to-tall").click();
      await page.locator("#page-tall").waitFor();
      await page.waitForTimeout(100);
      expect(await page.evaluate(() => window.scrollY)).toBe(scrolled);
    });
  });

  describe("links that must not be intercepted", () => {
    it("opens target=_blank links in a new page", async () => {
      const { page } = await browser.open(app.url("/"));
      const [popup] = await Promise.all([
        page.context().waitForEvent("page"),
        page.locator("#link-blank").click(),
      ]);
      await popup.waitForLoadState();
      expect(new URL(popup.url()).pathname).toBe("/b");
      expect(new URL(page.url()).pathname).toBe("/");
    });

    it('does a full page load for rel="external"', async () => {
      const { page } = await browser.open(app.url("/"));
      await markWindow(page);
      await page.locator("#link-external-rel").click();
      await page.waitForURL(app.url("/b"));
      await page.locator("#page-b").waitFor();
      expect(await windowMarkerSurvived(page)).toBe(false);
    });

    it("leaves modified clicks to the browser", async () => {
      const { page } = await browser.open(app.url("/"));
      const modifier = process.platform === "darwin" ? "Meta" : "Control";
      const [popup] = await Promise.all([
        page.context().waitForEvent("page"),
        page.locator("#link-b").click({ modifiers: [modifier] }),
      ]);
      await popup.waitForLoadState();
      expect(new URL(page.url()).pathname).toBe("/");
    });
  });

  describe("prefetching", () => {
    it("prefetches links in the viewport by default", async () => {
      const { page, rscRequests } = await browser.open(app.url("/"));
      await page.waitForFunction(() =>
        performance.getEntriesByType("resource").some((entry) => entry.name.endsWith("/a.rsc")),
      );
      expect(rscRequests()).toContain("/a.rsc");
    });

    it("uses the prefetched payload instead of fetching again on click", async () => {
      const { page, rscRequests } = await browser.open(app.url("/"));
      await page.waitForFunction(() =>
        performance.getEntriesByType("resource").some((entry) => entry.name.endsWith("/a.rsc")),
      );
      await page.locator("#link-a").click();
      await page.locator("#page-a").waitFor();
      expect(rscRequests().filter((request) => request === "/a.rsc")).toHaveLength(1);
    });

    it("does not prefetch with prefetch={false}", async () => {
      const { page, rscRequests } = await browser.open(app.url("/"));
      await page.waitForTimeout(300);
      expect(rscRequests()).not.toContain("/b.rsc");
      expect(rscRequests()).not.toContain("/dynamic.rsc");
    });

    it('prefetches on hover with prefetch="hover"', async () => {
      const { page, rscRequests } = await browser.open(app.url("/"));
      await page.waitForTimeout(300);
      expect(rscRequests()).not.toContain("/c.rsc");

      await page.locator("#link-c").hover();
      await page.waitForFunction(() =>
        performance.getEntriesByType("resource").some((entry) => entry.name.endsWith("/c.rsc")),
      );
    });

    it("does not prefetch links that open elsewhere", async () => {
      const { page, rscRequests } = await browser.open(app.url("/"));
      await page.waitForTimeout(300);
      // The only links to /b are prefetch={false}, target=_blank, rel=external and download.
      expect(rscRequests()).not.toContain("/b.rsc");
    });
  });

  describe("route cache", () => {
    it("reuses a static page's payload within its stale time", async () => {
      const { page, rscRequests } = await browser.open(app.url("/"));
      await page.locator("#link-b").click();
      await page.locator("#page-b").waitFor();
      await page.locator("#nav-home").click();
      await page.locator("#page-home").waitFor();
      await page.locator("#link-b").click();
      await page.locator("#page-b").waitFor();

      expect(rscRequests().filter((request) => request === "/b.rsc")).toHaveLength(1);
    });

    it("fetches a dynamic page's payload on every navigation", async () => {
      const { page, rscRequests } = await browser.open(app.url("/"));
      await page.locator("#link-dynamic").click();
      await page.locator("#page-dynamic").waitFor();
      const firstId = await page.locator("#render-id").textContent();

      await page.locator("#nav-home").click();
      await page.locator("#page-home").waitFor();
      await page.locator("#link-dynamic").click();
      await page.locator("#page-dynamic").waitFor();
      await page.waitForFunction(
        (previous) => document.querySelector("#render-id")?.textContent !== previous,
        firstId,
      );

      expect(rscRequests().filter((request) => request === "/dynamic.rsc")).toHaveLength(2);
    });
  });

  describe("useRouter()", () => {
    it("push() navigates and adds a history entry", async () => {
      const { page } = await browser.open(app.url("/router"));
      await markWindow(page);
      const before = await page.evaluate(() => history.length);

      await page.locator("#push-a").click();
      await page.locator("#page-a").waitFor();

      expect(await page.evaluate(() => history.length)).toBe(before + 1);
      expect(await windowMarkerSurvived(page)).toBe(true);
    });

    it("replace() navigates without adding a history entry", async () => {
      const { page } = await browser.open(app.url("/router"));
      const before = await page.evaluate(() => history.length);
      await page.locator("#replace-b").click();
      await page.locator("#page-b").waitFor();
      expect(await page.evaluate(() => history.length)).toBe(before);
    });

    it("refresh() re-renders the current route from the server without reloading", async () => {
      const { page } = await browser.open(app.url("/router"));
      await markWindow(page);
      const firstId = await page.locator("#render-id").textContent();

      await page.locator("#refresh").click();
      await page.waitForFunction(
        (previous) => document.querySelector("#render-id")?.textContent !== previous,
        firstId,
      );
      expect(await windowMarkerSurvived(page)).toBe(true);
    });

    it("back() goes to the previous history entry", async () => {
      const { page } = await browser.open(app.url("/"));
      await page.evaluate(() => {
        const runtime = (globalThis as Record<string, unknown>).__NLITE_NAVIGATION_RUNTIME__ as {
          push(href: string): void;
        };
        runtime.push("/router");
      });
      await page.locator("#page-router").waitFor();
      await page.locator("#back").click();
      await page.locator("#page-home").waitFor();
    });

    it("prefetch() loads a route's payload ahead of navigation", async () => {
      const { page, rscRequests } = await browser.open(app.url("/router"));
      await page.locator("#prefetch-c").click();
      await page.waitForFunction(() =>
        performance.getEntriesByType("resource").some((entry) => entry.name.endsWith("/c.rsc")),
      );
      expect(rscRequests()).toContain("/c.rsc");
    });
  });
});
