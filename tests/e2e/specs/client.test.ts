import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { fixtureDir, useFixture } from "../harness/fixture.js";
import { useBrowser } from "../harness/browser.js";
import { textById } from "../harness/html.js";
import { html } from "../harness/render.js";

const FIXTURE = "client";

function clientChunks() {
  const dir = path.join(fixtureDir(FIXTURE), ".nlite", "client", "_nlite", "chunks");
  return readdirSync(dir).map((file) => readFileSync(path.join(dir, file), "utf8"));
}

describe("client components and hydration", () => {
  const app = useFixture(FIXTURE);
  const browser = useBrowser();

  describe("server render", () => {
    it("renders client components with their initial props", async () => {
      const body = await html(await app.fetch("/"));
      expect(textById(body, "counter-label")).toBe("from the server");
      expect(textById(body, "count")).toBe("5");
      expect(textById(body, "mounted")).toBe("server");
    });

    it("serializes rich props and server-rendered children for client components", async () => {
      const body = await html(await app.fetch("/"));
      expect(textById(body, "prop-date")).toBe("2024-01-02T03:04:05.000Z");
      expect(textById(body, "prop-nested")).toBe("deep");
      expect(textById(body, "prop-list")).toBe("1,2,3");
      expect(textById(body, "server-child")).toBe("server child");
    });

    it("loads .env values for server code", async () => {
      expect(textById(await html(await app.fetch("/")), "server-secret")).toBe(
        "server-only-secret-value",
      );
    });

    // During SSR usePathname() returns "/" for every route (useSearchParams() is right),
    // so the pathname changes after hydration.
    it("renders usePathname() with the request path", async () => {
      const body = await html(await app.fetch("/hooks?q=ssr"));
      expect(textById(body, "pathname")).toBe("/hooks");
    });

    it("renders useSearchParams() with the request query", async () => {
      const body = await html(await app.fetch("/hooks?q=ssr"));
      expect(textById(body, "search-q")).toBe("ssr");
    });
  });

  describe("environment variables", () => {
    it("exposes NLITE_PUBLIC_ variables to client code", async () => {
      const body = await html(await app.fetch("/"));
      expect(textById(body, "public-env")).toBe("hello-from-env");
    });

    it("does not expose other variables to client code", async () => {
      const body = await html(await app.fetch("/"));
      expect(textById(body, "private-env")).toBe("undefined");
    });

    it("keeps non-public values out of the client bundle", () => {
      const chunks = clientChunks();
      expect(chunks.some((chunk) => chunk.includes("hello-from-env"))).toBe(true);
      expect(chunks.some((chunk) => chunk.includes("server-only-secret-value"))).toBe(false);
    });
  });

  describe("in the browser", () => {
    it("hydrates without errors", async () => {
      const { page, errors } = await browser.open(app.url("/"));
      await page.locator("#mounted", { hasText: "client" }).waitFor();
      expect(errors, errors.join("\n")).toEqual([]);
    });

    it("makes client components interactive", async () => {
      const { page } = await browser.open(app.url("/"));
      await page.locator("#increment").click();
      await page.locator("#increment").click();
      await page.locator("#count", { hasText: "7" }).waitFor();
    });

    it("keeps the Date prop type across the server/client boundary", async () => {
      const { page } = await browser.open(app.url("/"));
      expect(await page.locator("#prop-date").textContent()).toBe("2024-01-02T03:04:05.000Z");
    });

    it("applies CSS imported by a layout", async () => {
      const { page } = await browser.open(app.url("/"));
      const color = await page.locator("#styled").evaluate((node) => getComputedStyle(node).color);
      expect(color).toBe("rgb(255, 0, 0)");
    });

    it("reads usePathname() and useSearchParams() after hydration", async () => {
      const { page } = await browser.open(app.url("/hooks?q=browser"));
      expect(await page.locator("#pathname").textContent()).toBe("/hooks");
      expect(await page.locator("#search-q").textContent()).toBe("browser");
    });

    it("does not request the RSC payload separately on first load", async () => {
      const { rscRequests } = await browser.open(app.url("/hooks"));
      expect(rscRequests()).toEqual([]);
    });
  });

  describe("public directory", () => {
    it("serves files from public/", async () => {
      const response = await app.fetch("/robots.txt");
      expect(response.status).toBe(200);
      expect(await response.text()).toContain("User-agent: *");
    });
  });
});
