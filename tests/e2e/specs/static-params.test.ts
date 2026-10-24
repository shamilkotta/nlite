import { describe, expect, it } from "vitest";

import { clientOutputExists, readClientOutput, useFixture } from "../harness/fixture.js";
import { textById } from "../harness/html.js";
import { expectDynamic, expectStatic, html } from "../harness/render.js";

const FIXTURE = "static-params";

describe("generateStaticParams", () => {
  const app = useFixture(FIXTURE);

  describe("single dynamic segment (async generateStaticParams)", () => {
    it("prerenders every returned param", () => {
      expect(clientOutputExists(FIXTURE, "blog/first.html")).toBe(true);
      expect(clientOutputExists(FIXTURE, "blog/second.html")).toBe(true);
      expect(clientOutputExists(FIXTURE, "blog/first.rsc")).toBe(true);
    });

    it("passes the param to the page at build time", () => {
      expect(textById(readClientOutput(FIXTURE, "blog/second.html"), "slug")).toBe("second");
    });

    it("serves listed params from the build output", async () => {
      const builtId = textById(readClientOutput(FIXTURE, "blog/first.html"), "render-id");
      const response = await app.fetch("/blog/first");
      expectStatic(response);
      expect(textById(await response.text(), "render-id")).toBe(builtId);
    });

    it("renders params that were not returned on demand, without writing files", async () => {
      const response = await app.fetch("/blog/third");
      expect(response.status).toBe(200);
      expectDynamic(response);
      expect(textById(await response.text(), "slug")).toBe("third");
      expect(clientOutputExists(FIXTURE, "blog/third.html")).toBe(false);
    });

    it("responds 404 when the page calls notFound() for an unknown param", async () => {
      const response = await app.fetch("/blog/gone");
      expect(response.status).toBe(404);
    });
  });

  describe("catch-all segment", () => {
    it("prerenders single and nested paths", () => {
      expect(clientOutputExists(FIXTURE, "docs/intro.html")).toBe(true);
      expect(clientOutputExists(FIXTURE, "docs/guide/install.html")).toBe(true);
    });

    it("passes catch-all params as arrays", async () => {
      const response = await app.fetch("/docs/guide/install");
      expectStatic(response);
      expect(JSON.parse(textById(await response.text(), "path")!)).toEqual(["guide", "install"]);
    });

    it("renders unlisted deeper paths on demand", async () => {
      const response = await app.fetch("/docs/guide/install/macos");
      expectDynamic(response);
      expect(JSON.parse(textById(await response.text(), "path")!)).toEqual([
        "guide",
        "install",
        "macos",
      ]);
    });

    it("does not match the catch-all base path", async () => {
      expect((await app.fetch("/docs")).status).toBe(404);
    });
  });

  describe("multiple dynamic segments", () => {
    it("prerenders the combined path", async () => {
      expect(clientOutputExists(FIXTURE, "shop/shoes/boot.html")).toBe(true);
      const response = await app.fetch("/shop/shoes/boot");
      expectStatic(response);
      const body = await response.text();
      expect(textById(body, "category")).toBe("shoes");
      expect(textById(body, "item")).toBe("boot");
    });

    it("renders other combinations on demand", async () => {
      const response = await app.fetch("/shop/hats/cap");
      expectDynamic(response);
      expect(textById(await response.text(), "item")).toBe("cap");
    });
  });

  describe("empty generateStaticParams", () => {
    it("prerenders nothing", () => {
      expect(clientOutputExists(FIXTURE, "empty")).toBe(false);
    });

    it("still renders the route on demand", async () => {
      const response = await app.fetch("/empty/anything");
      expect(response.status).toBe(200);
      expectDynamic(response);
      expect(textById(await response.text(), "id")).toBe("anything");
    });
  });

  describe("prerendered params that read searchParams", () => {
    it("bakes the build-time (empty) query into the page", async () => {
      const response = await app.fetch("/baked/x?view=grid");
      expectStatic(response);
      expect(textById(await html(response), "view")).toBe("default");
    });

    it("still reads the query for params rendered on demand", async () => {
      const response = await app.fetch("/baked/y?view=grid");
      expectDynamic(response);
      expect(textById(await html(response), "view")).toBe("grid");
    });
  });

  describe("params that need URL encoding", () => {
    it("writes the prerendered file with an encoded name", () => {
      expect(clientOutputExists(FIXTURE, "encoded/hello%20world.html")).toBe(true);
    });

    it("decodes the param for the page", async () => {
      const response = await app.fetch("/encoded/hello%20world");
      expect(response.status).toBe(200);
      expect(textById(await response.text(), "name")).toBe("hello world");
    });

    // Known bug: the file is written as `hello%20world.html`, but the preview server decodes the
    // request path before looking it up, so the prerendered page is never served.
    it("serves the prerendered file for an encoded param", async () => {
      const response = await app.fetch("/encoded/hello%20world");
      expectStatic(response);
    });
  });
});
