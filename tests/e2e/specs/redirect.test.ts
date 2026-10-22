import { describe, expect, it } from "vitest";

import { readClientOutput, useFixture } from "../harness/fixture.js";
import { markWindow, useBrowser, windowMarkerSurvived } from "../harness/browser.js";
import { hasId, textById } from "../harness/html.js";
import { expectStatic } from "../harness/render.js";

const FIXTURE = "redirect";

describe("redirect()", () => {
  const app = useFixture(FIXTURE);
  const browser = useBrowser();

  describe("HTTP responses", () => {
    it("answers 307 with a Location header from a dynamic page", async () => {
      const response = await app.fetch("/dynamic");
      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe("/target");
    });

    it("includes a meta refresh fallback in the redirect body", async () => {
      const body = await (await app.fetch("/dynamic")).text();
      expect(body).toContain('<meta http-equiv="refresh" content="0;url=/target"/>');
    });

    it("keeps absolute external URLs and their query strings", async () => {
      const response = await app.fetch("/external");
      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe("https://example.com/elsewhere?from=nlite");
    });

    it("redirects only when the condition holds", async () => {
      const redirected = await app.fetch("/conditional");
      expect(redirected.status).toBe(307);
      expect(redirected.headers.get("location")).toBe("/target?reason=login");

      const allowed = await app.fetch("/conditional", { headers: { cookie: "session=ada" } });
      expect(allowed.status).toBe(200);
      expect(textById(await allowed.text(), "secret")).toBe("Signed in as ada");
    });

    it("redirects from a layout before the page renders", async () => {
      const response = await app.fetch("/from-layout");
      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe("/target");

      const allowed = await app.fetch("/from-layout", { headers: { "x-allow": "yes" } });
      expect(allowed.status).toBe(200);
      expect(textById(await allowed.text(), "guarded")).toBe("Guarded by the layout");
    });

    it("cannot change the status once the response is streaming", async () => {
      const response = await app.fetch("/streamed");
      expect(response.status).toBe(200);
      const body = await response.text();
      expect(textById(body, "streamed-shell")).toBe("Already streaming");
      expect(body).toContain("NLITE_REDIRECT;replace;/target;307;");
    });

    it("encodes the redirect in the RSC payload for client navigations", async () => {
      const response = await app.fetch("/dynamic.rsc");
      expect(response.headers.get("content-type")).toMatch(/^text\/x-component/);
      expect(await response.text()).toContain("NLITE_REDIRECT;replace;/target;307;");
    });
  });

  describe("static pages", () => {
    it("prerenders a meta refresh document", () => {
      const built = readClientOutput(FIXTURE, "static.html");
      expect(built).toContain('<meta http-equiv="refresh" content="0;url=/target"/>');
      expect(built).toContain("<title>Redirecting...</title>");
      expect(hasId(built, "target")).toBe(false);
    });

    it("serves the prerendered redirect document", async () => {
      const response = await app.fetch("/static");
      expectStatic(response);
      expect(response.status).toBe(200);
    });
  });

  describe("in the browser", () => {
    it("lands on the target after loading a static redirect page", async () => {
      const { page } = await browser.open(app.url("/static"));
      await page.waitForURL(app.url("/target"));
      await page.locator("#target").waitFor();
    });

    it("lands on the target when the redirect happens after streaming started", async () => {
      const { page } = await browser.open(app.url("/streamed"));
      await page.waitForURL(app.url("/target"));
      await page.locator("#target").waitFor();
    });

    it("follows the HTTP redirect on a document load", async () => {
      const { page } = await browser.open(app.url("/dynamic"));
      expect(new URL(page.url()).pathname).toBe("/target");
    });

    it("redirects during a client navigation without a full reload", async () => {
      const { page } = await browser.open(app.url("/links"));
      await markWindow(page);

      await page.locator("#to-dynamic").click();
      await page.waitForURL(app.url("/target"));
      await page.locator("#target").waitFor();
      expect(await windowMarkerSurvived(page)).toBe(true);
    });

    it("replaces the history entry of the redirecting URL", async () => {
      const { page } = await browser.open(app.url("/links"));
      await page.locator("#to-dynamic").click();
      await page.waitForURL(app.url("/target"));

      await page.goBack();
      await page.waitForURL(app.url("/links"));
    });
  });
});
