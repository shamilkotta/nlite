import { describe, expect, it } from "vitest";

import { clientOutputExists, readClientOutput, readJsonOutput, useFixture } from "../harness/fixture.js";
import { textById } from "../harness/html.js";
import { expectDynamic, expectStatic, html } from "../harness/render.js";
import { useUpstream } from "../harness/upstream.js";

const FIXTURE = "ssg";

describe("static generation (automatic)", () => {
  const upstream = useUpstream();
  const app = useFixture(FIXTURE, "preview", () => ({ env: { UPSTREAM_URL: upstream.url } }));

  describe("build output", () => {
    it("writes html, rsc and meta files for a page without request APIs", () => {
      expect(clientOutputExists(FIXTURE, "index.html")).toBe(true);
      expect(clientOutputExists(FIXTURE, ".rsc")).toBe(true);
      expect(readJsonOutput(FIXTURE, "index.meta")).toEqual({ renderingMode: "STATIC" });
    });

    it("writes nested routes to nested files", () => {
      expect(clientOutputExists(FIXTURE, "about/team.html")).toBe(true);
      expect(clientOutputExists(FIXTURE, "about/team.rsc")).toBe(true);
    });

    it("strips route groups from output paths", () => {
      expect(clientOutputExists(FIXTURE, "pricing.html")).toBe(true);
      expect(clientOutputExists(FIXTURE, "(marketing)/pricing.html")).toBe(false);
    });

    it("prerenders the global not-found page", () => {
      expect(clientOutputExists(FIXTURE, "_not-found.html")).toBe(true);
      expect(clientOutputExists(FIXTURE, "_not-found.rsc")).toBe(true);
    });

    it("writes a _headers file with the default static and dynamic stale times", () => {
      const headers = readClientOutput(FIXTURE, "_headers");
      expect(headers).toContain("/*.rsc\n  x-nlite-staletime: 300");
      expect(headers).toContain("/_not-found.rsc\n  x-nlite-staletime: 0");
    });

    it("does not prerender a page that reads cookies()", () => {
      expect(clientOutputExists(FIXTURE, "cookie-reader.html")).toBe(false);
      expect(clientOutputExists(FIXTURE, "cookie-reader.meta")).toBe(false);
    });

    it("does not prerender a dynamic segment without generateStaticParams", () => {
      expect(clientOutputExists(FIXTURE, "items")).toBe(false);
    });

    it("does not prerender a page with an uncached fetch()", () => {
      expect(clientOutputExists(FIXTURE, "uncached-fetch.html")).toBe(false);
    });

    it("keeps a page that only uses fetch(..., { cache: 'force-cache' }) static", () => {
      expect(clientOutputExists(FIXTURE, "cached-fetch.html")).toBe(true);
    });
  });

  describe("serving", () => {
    it("serves the prerendered html on every request", async () => {
      const builtId = textById(readClientOutput(FIXTURE, "index.html"), "render-id");

      const first = await app.fetch("/");
      expectStatic(first);
      const second = await app.fetch("/");

      expect(textById(await html(first), "render-id")).toBe(builtId);
      expect(textById(await html(second), "render-id")).toBe(builtId);
    });

    it("renders the page inside the root layout", async () => {
      const body = await html(await app.fetch("/"));
      expect(body).toMatch(/<div id="root-layout"><main><h1 id="title">Home<\/h1>/);
    });

    it("serves nested static routes", async () => {
      const response = await app.fetch("/about/team");
      expectStatic(response);
      expect(textById(await response.text(), "render-id")).toBe(
        textById(readClientOutput(FIXTURE, "about/team.html"), "render-id"),
      );
    });

    it("serves a route inside a route group without the group segment", async () => {
      const response = await app.fetch("/pricing");
      expect(response.status).toBe(200);
      expectStatic(response);
      expect(textById(await response.text(), "pricing")).toMatch(/^Pricing /);
    });

    it("does not expose the route group name in the URL", async () => {
      const response = await app.fetch("/(marketing)/pricing");
      expect(response.status).toBe(404);
    });

    it("ignores the query string for a page that does not read searchParams", async () => {
      const builtId = textById(readClientOutput(FIXTURE, "index.html"), "render-id");
      const response = await app.fetch("/?utm_source=e2e&page=2");
      expectStatic(response);
      expect(textById(await response.text(), "render-id")).toBe(builtId);
    });

    it("serves the same page for a trailing slash", async () => {
      const builtId = textById(readClientOutput(FIXTURE, "about/team.html"), "render-id");
      const response = await app.fetch("/about/team/");
      expect(response.status).toBe(200);
      expect(textById(await response.text(), "render-id")).toBe(builtId);
    });

    it("answers HEAD with headers and an empty body", async () => {
      const response = await app.fetch("/", { method: "HEAD" });
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toMatch(/^text\/html/);
      expect(await response.text()).toBe("");
    });

    it("serves the RSC payload of a static page with the static stale time", async () => {
      const response = await app.fetch("/about/team.rsc");
      expect(response.status).toBe(200);
      expect(response.headers.get("x-nlite-staletime")).toBe("300");
      expect(await response.text()).toBe(readClientOutput(FIXTURE, "about/team.rsc"));
    });

    it("serves the root RSC payload from /.rsc", async () => {
      const response = await app.fetch("/.rsc");
      expect(response.status).toBe(200);
      expect(await response.text()).toBe(readClientOutput(FIXTURE, ".rsc"));
    });

    // Known bug: vite's static server has no MIME type for `.rsc`, so prerendered payloads
    // go out with an empty Content-Type while on-demand payloads use text/x-component.
    it.fails("serves static RSC payloads as text/x-component", async () => {
      const response = await app.fetch("/about/team.rsc");
      expect(response.headers.get("content-type")).toMatch(/^text\/x-component/);
    });

    it("bakes a force-cache fetch into the page and never calls the upstream at request time", async () => {
      const hitsAfterBuild = upstream.hits("/ssg-cached");
      expect(hitsAfterBuild).toBeGreaterThanOrEqual(1);

      const response = await app.fetch("/cached-fetch");
      expectStatic(response);
      await app.fetch("/cached-fetch");

      expect(upstream.hits("/ssg-cached")).toBe(hitsAfterBuild);
    });
  });

  describe("pages that are not static", () => {
    it("renders a cookies() page on every request", async () => {
      const first = await app.fetch("/cookie-reader", { headers: { cookie: "user=ada" } });
      expectDynamic(first);
      const firstHtml = await html(first);
      const second = await html(await app.fetch("/cookie-reader"));

      expect(textById(firstHtml, "user")).toBe("ada");
      expect(textById(second, "user")).toBe("anonymous");
      expect(textById(firstHtml, "render-id")).not.toBe(textById(second, "render-id"));
    });

    it("renders a dynamic segment without generateStaticParams on demand", async () => {
      const response = await app.fetch("/items/42");
      expect(response.status).toBe(200);
      expectDynamic(response);
      expect(textById(await response.text(), "item")).toBe("42");
    });

    it("calls the upstream on every request for an uncached fetch()", async () => {
      const before = upstream.hits("/ssg-uncached");
      const response = await app.fetch("/uncached-fetch");
      expectDynamic(response);
      expect(Number(textById(await response.text(), "hit"))).toBe(before + 1);
      await app.fetch("/uncached-fetch");
      expect(upstream.hits("/ssg-uncached")).toBe(before + 2);
    });
  });
});
