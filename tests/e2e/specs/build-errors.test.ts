import { describe, expect, it } from "vitest";

import { buildFixture, readClientOutput } from "../harness/fixture.js";
import { textById } from "../harness/html.js";

const fixture = (name: string) => `build-errors/${name}`;

describe("build errors", () => {
  describe("invalid apps fail the build with a useful message", () => {
    it("force-ssg dynamic route without generateStaticParams", async () => {
      const result = await buildFixture(fixture("force-ssg-without-params"));
      expect(result.code).not.toBe(0);
      expect(result.output).toContain(
        'Route "/posts/:slug" uses force-ssg but does not export generateStaticParams()',
      );
    });

    it("page and route in the same segment", async () => {
      const result = await buildFixture(fixture("page-and-route"));
      expect(result.code).not.toBe(0);
      expect(result.output).toContain('Route segment "both" has both a page and route module');
    });

    it("import that cannot be resolved", async () => {
      const result = await buildFixture(fixture("missing-import"));
      expect(result.code).not.toBe(0);
      expect(result.output).toContain(
        "Could not resolve './does-not-exist' in app/broken/page.tsx",
      );
    });

    it("generateStaticParams that throws", async () => {
      const result = await buildFixture(fixture("params-throw"));
      expect(result.code).not.toBe(0);
      expect(result.output).toContain("E2E_PARAMS_THROW");
    });

    it("static page that throws while prerendering", async () => {
      const result = await buildFixture(fixture("static-page-throws"));
      expect(result.code).not.toBe(0);
      expect(result.output).toContain("E2E_STATIC_PAGE_THROWS");
    });
  });

  describe("error messages that should be clearer", () => {
    it("names the route whose static prerender threw", async () => {
      const result = await buildFixture(fixture("static-page-throws"));
      expect(result.output).toContain("/broken");
    });

    // Currently: "DynamicPrerenderUsageError: Route used request-bound data during prerender".
    it("reports a page without a default export as such", async () => {
      const result = await buildFixture(fixture("missing-default-export"));
      expect(result.code).not.toBe(0);
      expect(result.output).toMatch(/default export/i);
      expect(result.output).not.toContain("request-bound data");
    });

    // Currently: "TypeError: paramsList is not iterable".
    it("reports generateStaticParams returning a non-array", async () => {
      const result = await buildFixture(fixture("params-not-array"));
      expect(result.code).not.toBe(0);
      expect(result.output).toMatch(/generateStaticParams/);
    });
  });

  describe("conflicts", () => {
    // Two route groups both define /same; the build silently keeps the first one.
    it("rejects two route groups that resolve to the same path", async () => {
      const result = await buildFixture(fixture("duplicate-route-groups"));
      expect(result.code).not.toBe(0);
    });
  });

  describe("valid edge cases", () => {
    it("builds an app without a root layout", async () => {
      const result = await buildFixture(fixture("no-root-layout"));
      expect(result.code).toBe(0);
      const built = readClientOutput(fixture("no-root-layout"), "index.html");
      expect(built).toMatch(/^<!DOCTYPE html><html/);
      expect(textById(built, "home")).toBe("No root layout");
    });
  });
});
