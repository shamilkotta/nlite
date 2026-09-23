import { fileURLToPath } from "node:url";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chromium, type Browser, type Page } from "playwright";

import { createApp, type E2EApp } from "../helpers/server.ts";

const fixtureDir = path.dirname(fileURLToPath(import.meta.url));

describe("error-boundary", () => {
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

  it("catches client errors with error.tsx and supports reset", async () => {
    await page.goto(app.baseURL + "/");
    await expect.poll(async () => page.getByTestId("error-demo-page").count()).toBeGreaterThan(0);
    await page.getByTestId("boom-button").click();
    await expect.poll(async () => page.getByTestId("error-fallback").count()).toBeGreaterThan(0);
    await expect
      .poll(async () => page.getByTestId("error-message").textContent())
      .toBe("Intentional boom");
    await page.getByTestId("error-reset").click();
    await expect.poll(async () => page.getByTestId("boom-button").count()).toBeGreaterThan(0);
  });
});
