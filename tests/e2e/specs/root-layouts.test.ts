import { describe, expect, it } from "vitest";

import { useFixture } from "../harness/fixture.js";
import { markWindow, useBrowser, windowMarkerSurvived } from "../harness/browser.js";

const FIXTURE = "root-layouts";

describe("multiple root layouts", () => {
  const app = useFixture(FIXTURE);
  const browser = useBrowser();

  const rootOf = (page: Awaited<ReturnType<typeof browser.open>>["page"]) =>
    page.evaluate(() => document.documentElement.dataset.root);

  it("navigates client-side within the same root layout", async () => {
    const { page } = await browser.open(app.url("/"));
    await markWindow(page);

    await page.locator("#link-about").click();
    await page.locator("#page-about").waitFor();

    expect(await windowMarkerSurvived(page)).toBe(true);
    expect(await rootOf(page)).toBe("marketing");
  });

  it("does a full page load when the root layout changes", async () => {
    const { page } = await browser.open(app.url("/"));
    await markWindow(page);
    const before = await page.evaluate(() => history.length);

    await page.locator("#link-shop").click();
    await page.locator("#page-shop").waitFor();

    expect(new URL(page.url()).pathname).toBe("/shop");
    expect(await windowMarkerSurvived(page)).toBe(false);
    expect(await rootOf(page)).toBe("shop");
    expect(await page.evaluate(() => history.length)).toBe(before + 1);
  });

  it("replaces the history entry for a cross root layout replace", async () => {
    const { page } = await browser.open(app.url("/"));
    const before = await page.evaluate(() => history.length);

    await page.locator("#replace-shop").click();
    await page.locator("#page-shop").waitFor();

    expect(await rootOf(page)).toBe("shop");
    expect(await page.evaluate(() => history.length)).toBe(before);
  });

  it("loads the previous root layout on back and forward", async () => {
    const { page } = await browser.open(app.url("/"));
    await page.locator("#link-shop").click();
    await page.locator("#page-shop").waitFor();

    await page.goBack();
    await page.locator("#page-home").waitFor();
    expect(await rootOf(page)).toBe("marketing");

    await page.goForward();
    await page.locator("#page-shop").waitFor();
    expect(await rootOf(page)).toBe("shop");
  });

  it("keeps a dynamic root layout across different param values", async () => {
    const { page } = await browser.open(app.url("/en"));
    await markWindow(page);

    await page.locator("#link-fr").click();
    await page.locator("#page-fr").waitFor();

    expect(await windowMarkerSurvived(page)).toBe(true);
    expect(await rootOf(page)).toBe("intl");
  });

  it("renders not-found in the root layout of / and crosses into it with a full load", async () => {
    const { page } = await browser.open(app.url("/"));
    await markWindow(page);
    await page.locator("#link-missing").click();
    await page.getByText("This page could not be found.").waitFor();
    expect(await windowMarkerSurvived(page)).toBe(true);

    await page.locator("#link-shop").click();
    await page.locator("#page-shop").waitFor();
    await markWindow(page);
    await page.locator("#link-missing").click();
    await page.getByText("This page could not be found.").waitFor();
    expect(await windowMarkerSurvived(page)).toBe(false);
    expect(await rootOf(page)).toBe("marketing");
  });
});
