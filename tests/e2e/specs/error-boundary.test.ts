import { describe, expect, it } from "vitest";

import { useFixture } from "../harness/fixture.js";
import { useBrowser } from "../harness/browser.js";
import { textById } from "../harness/html.js";

const FIXTURE = "error-boundary";

describe("error boundaries (error.tsx)", () => {
  const app = useFixture(FIXTURE);
  const browser = useBrowser();

  describe("HTTP responses", () => {
    it("responds 500 when a page throws while rendering the shell", async () => {
      const response = await app.fetch("/broken");
      expect(response.status).toBe(500);
      expect(response.headers.get("content-type")).toMatch(/^text\/html/);
    });

    it("logs the server error", async () => {
      await app.fetch("/no-boundary");
      expect(app.logs()).toContain("[nlite] SSR render failed");
    });

    it("keeps serving other routes after a render error", async () => {
      await app.fetch("/broken");
      const response = await app.fetch("/");
      expect(response.status).toBe(200);
      expect(textById(await response.text(), "home")).toBe("Home");
    });

    it("keeps the 200 status and the shell when the error is inside a Suspense boundary", async () => {
      const response = await app.fetch("/suspended");
      expect(response.status).toBe(200);
      expect(textById(await response.text(), "suspended-shell")).toBe("Shell renders");
    });

    // Known issue: the RSC error digest is the raw `error.message`, so server-side error
    // messages (which may contain secrets) are sent to the client.
    it("does not leak server error messages to the client", async () => {
      const html = await (await app.fetch("/secret")).text();
      const rsc = await (await app.fetch("/secret.rsc")).text();
      expect(html).not.toContain("SUPER_SECRET_VALUE_123");
      expect(rsc).not.toContain("SUPER_SECRET_VALUE_123");
    });
  });

  describe("in the browser", () => {
    it("renders the segment's error.tsx", async () => {
      const { page } = await browser.open(app.url("/broken"));
      await page.locator("#segment-error").waitFor();
      expect(await page.locator("#root-layout").count()).toBe(1);
    });

    it("renders the built-in error UI when no error.tsx exists", async () => {
      const { page } = await browser.open(app.url("/no-boundary"));
      await page.getByRole("heading", { name: "Something went wrong" }).waitFor();
      expect(await page.getByRole("button", { name: "Try again" }).count()).toBe(1);
      expect(await page.getByRole("button", { name: "Reload" }).count()).toBe(1);
    });

    it("keeps the segment's layout around its error.tsx", async () => {
      const { page } = await browser.open(app.url("/nested/child"));
      await page.locator("#nested-error").waitFor();
      expect(await page.locator("#nested-layout").textContent()).toBe("Nested layout survives");
    });

    it("replaces the segment's page with error.tsx for an error inside a Suspense boundary", async () => {
      const { page } = await browser.open(app.url("/suspended"));
      await page.locator("#suspended-error").waitFor();
      expect(await page.locator("#suspended-shell").count()).toBe(0);
      expect(await page.locator("#root-layout").count()).toBe(1);
    });

    it("catches client render errors and recovers with reset()", async () => {
      const { page } = await browser.open(app.url("/client-error"));

      await page.locator("#break").click();
      await page.locator("#client-error", { hasText: "client render failure" }).waitFor();

      // reset() remounts the segment, so the component starts again from its initial state.
      await page.locator("#reset").click();
      await page.locator("#break", { hasText: "break me" }).waitFor();
      expect(await page.locator("#client-error").count()).toBe(0);
    });
  });
});
