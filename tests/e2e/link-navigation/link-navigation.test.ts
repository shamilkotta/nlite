import { fileURLToPath } from "node:url";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chromium, type Browser, type Page } from "playwright";

import { createApp, type E2EApp } from "../helpers/server.ts";

const fixtureDir = path.dirname(fileURLToPath(import.meta.url));

describe("link-navigation", () => {
  let app: E2EApp;
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    app = await createApp(fixtureDir);
    browser = await chromium.launch({ headless: true });
    page = await browser.newPage();
  }, 120_000);

  afterAll(async () => {
    await page?.close();
    await browser?.close();
    await app?.close();
  });

  it("client-navigates via Link without a full document reload", async () => {
    await page.goto(app.baseURL + "/");
    await page.getByTestId("nav-about").click();
    await expect.poll(async () => page.getByTestId("about-page").count()).toBeGreaterThan(0);
    expect(page.url()).toMatch(/\/about$/);
  });
});
