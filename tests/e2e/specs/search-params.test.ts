import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildFixture, startServer, type RunningServer } from "../harness/fixture.js";
import { textById } from "../harness/html.js";
import { expectDynamic, html } from "../harness/render.js";

const FIXTURE = "search-params";

/**
 * Known bug: `trackSearchParams()` returns a thenable whose `then(onFulfilled, onRejected)` only
 * forwards `onRejected` to the inner promise. When `markDynamicUsage()` rejects during
 * prerendering, `await searchParams` never settles and the rejection is unhandled, which crashes
 * the prerender worker and fails `nlite build` (with or without PPR).
 */
const build = await buildFixture(FIXTURE);

describe("searchParams", () => {
  describe("build", () => {
    it("builds an app whose page awaits searchParams", () => {
      expect(build.output).not.toContain("DynamicPrerenderUsageError");
      expect(build.code).toBe(0);
    });

    it("builds a PPR app whose Suspense boundary awaits searchParams", async () => {
      const pprBuild = await buildFixture("search-params-ppr");
      expect(pprBuild.output).not.toContain("DynamicPrerenderUsageError");
      expect(pprBuild.code).toBe(0);
    });
  });

  describe("production (preview)", () => {
    let app: RunningServer;
    beforeAll(async () => {
      app = await startServer(FIXTURE, "preview");
    });
    afterAll(async () => {
      await app?.close();
    });

    it("renders the page on demand", async () => {
      const response = await app.fetch("/search?q=react");
      expectDynamic(response);
      expect(textById(await html(response), "q")).toBe("react");
    });

    it("renders a fresh result for each query", async () => {
      const first = await html(await app.fetch("/search?q=one"));
      const second = await html(await app.fetch("/search?q=two"));
      expect(textById(first, "q")).toBe("one");
      expect(textById(second, "q")).toBe("two");
    });

    it("streams the Suspense fallback before the query-dependent content", async () => {
      const body = await html(await app.fetch("/with-suspense?q=streamed"));
      expect(textById(body, "heading")).toBe("Search");
      expect(textById(body, "q")).toBe("streamed");
    });
  });

  describe("development (dev server)", () => {
    let app: RunningServer;
    beforeAll(async () => {
      app = await startServer(FIXTURE, "dev");
    });
    afterAll(async () => {
      await app?.close();
    });

    it("passes the query string to the page", async () => {
      const body = await html(await app.fetch("/search?q=react"));
      expect(textById(body, "q")).toBe("react");
    });

    it("keeps repeated keys", async () => {
      const body = await html(await app.fetch("/search?tag=a&tag=b&tag=c"));
      expect(textById(body, "tags")).toBe("a,b,c");
    });

    it("decodes encoded query values", async () => {
      const body = await html(await app.fetch("/search?q=hello%20world%26more"));
      expect(textById(body, "q")).toBe("hello world&more");
    });

    it("renders the empty state without a query string", async () => {
      const body = await html(await app.fetch("/search"));
      expect(textById(body, "q")).toBe("empty");
      expect(textById(body, "tags")).toBe("");
    });

    it("renders a fresh result for every request", async () => {
      const first = textById(await html(await app.fetch("/search?q=x")), "render-id");
      const second = textById(await html(await app.fetch("/search?q=x")), "render-id");
      expect(first).not.toBe(second);
    });

    it("resolves searchParams inside a Suspense boundary", async () => {
      const body = await html(await app.fetch("/with-suspense?q=suspended"));
      expect(textById(body, "q")).toBe("suspended");
    });

    it("passes the query string to the RSC payload render", async () => {
      const response = await app.fetch("/search.rsc?q=payload-query");
      expect(response.headers.get("content-type")).toMatch(/^text\/x-component/);
      expect(await response.text()).toContain("payload-query");
    });
  });
});
