import { rmSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import { fixtureDir, useFixture } from "../harness/fixture.js";
import { markWindow, useBrowser, windowMarkerSurvived } from "../harness/browser.js";
import { textById } from "../harness/html.js";

const FIXTURE = "dev";

async function poll(check: () => Promise<boolean>, timeout = 15_000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await check()) return true;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  return false;
}

describe("nlite dev (ppr: true)", () => {
  const app = useFixture(FIXTURE, "dev");
  const browser = useBrowser();

  describe("renders everything on demand", () => {
    it("re-renders static pages per request", async () => {
      const first = textById(await (await app.fetch("/static")).text(), "render-id");
      const second = textById(await (await app.fetch("/static")).text(), "render-id");
      expect(first).not.toBe(second);
    });

    it("reads request data in force-ssg pages", async () => {
      const body = await (
        await app.fetch("/force-ssg", { headers: { cookie: "user=ada" } })
      ).text();
      expect(textById(body, "user")).toBe("ada");
    });

    it("renders params outside generateStaticParams", async () => {
      expect(textById(await (await app.fetch("/posts/other")).text(), "slug")).toBe("other");
    });

    it("serves RSC payloads", async () => {
      const response = await app.fetch("/static.rsc");
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toMatch(/^text\/x-component/);
    });
  });

  describe("status codes", () => {
    it("answers 307 for a redirect from a static page", async () => {
      const response = await app.fetch("/static-redirect");
      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe("/target");
    });

    it("answers 404 for notFound() from a static page", async () => {
      expect((await app.fetch("/static-not-found")).status).toBe(404);
    });

    // Production (nlite preview / adapters) answers 200 for these; dev and prod disagree.
    it("answers 307 for a no-shell PPR route that redirects", async () => {
      const response = await app.fetch("/cookies-redirect");
      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe("/target");
    });

    it("answers 404 for a no-shell PPR route that calls notFound()", async () => {
      expect((await app.fetch("/cookies-not-found")).status).toBe(404);
    });

    it("answers 500 when a page throws", async () => {
      expect((await app.fetch("/throws")).status).toBe(500);
    });

    it("answers 404 for unknown routes with the not-found UI", async () => {
      const response = await app.fetch("/missing");
      expect(response.status).toBe(404);
      expect(textById(await response.text(), "root-not-found")).toBe("Root not found");
    });

    it("serves route handlers", async () => {
      expect(await (await app.fetch("/api/ping")).json()).toEqual({ pong: true });
    });
  });

  describe("in the browser", () => {
    it("hydrates client components", async () => {
      const { page } = await browser.open(app.url("/counter"));
      await page.locator("#count").click();
      await page.locator("#count", { hasText: "1" }).waitFor();
    });

    it("navigates on the client", async () => {
      const { page } = await browser.open(app.url("/"));
      await markWindow(page);
      await page.locator("#to-static").click();
      await page.locator("#static").waitFor();
      expect(await windowMarkerSurvived(page)).toBe(true);
    });

    it("follows a redirect during client navigation", async () => {
      const { page } = await browser.open(app.url("/"));
      await page.locator("#to-redirect").click();
      await page.waitForURL(app.url("/target"));
    });

    it("shows the error UI when a page throws", async () => {
      const { page } = await browser.open(app.url("/throws"));
      await page.locator("#root-error").waitFor();
    });
  });

  describe("route files changing at runtime", () => {
    const added = path.join(fixtureDir(FIXTURE), "app", "added-at-runtime");
    const addedApi = path.join(fixtureDir(FIXTURE), "app", "api", "added-at-runtime");

    afterAll(() => {
      rmSync(added, { recursive: true, force: true });
      rmSync(addedApi, { recursive: true, force: true });
    });

    it("serves a page added while the server runs, and 404s after it is removed", async () => {
      expect((await app.fetch("/added-at-runtime")).status).toBe(404);

      mkdirSync(added, { recursive: true });
      writeFileSync(
        path.join(added, "page.tsx"),
        'export default function Page() {\n  return <h1 id="added">Added</h1>;\n}\n',
      );
      expect(await poll(async () => (await app.fetch("/added-at-runtime")).status === 200)).toBe(
        true,
      );
      expect(textById(await (await app.fetch("/added-at-runtime")).text(), "added")).toBe("Added");

      rmSync(added, { recursive: true, force: true });
      expect(await poll(async () => (await app.fetch("/added-at-runtime")).status === 404)).toBe(
        true,
      );
    });

    it("serves a route handler added while the server runs", async () => {
      mkdirSync(addedApi, { recursive: true });
      writeFileSync(
        path.join(addedApi, "route.ts"),
        "export function GET() {\n  return Response.json({ added: true });\n}\n",
      );
      expect(
        await poll(async () => (await app.fetch("/api/added-at-runtime")).status === 200),
      ).toBe(true);
      rmSync(addedApi, { recursive: true, force: true });
    });
  });

  describe("logs", () => {
    it("does not log React key warnings", () => {
      expect(app.logs()).not.toMatch(/unique "key" prop/);
    });
  });
});
