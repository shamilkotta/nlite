import { describe, expect, it } from "vitest";

import {
  clientOutputExists,
  readClientOutput,
  readJsonOutput,
  useFixture,
} from "../harness/fixture.js";
import { textById } from "../harness/html.js";
import { expectDynamic, expectStatic, html } from "../harness/render.js";
import { useUpstream } from "../harness/upstream.js";

const FIXTURE = "force-ssg";

describe('rendering = "force-ssg"', () => {
  const upstream = useUpstream();
  const app = useFixture(FIXTURE, "preview", () => ({ env: { UPSTREAM_URL: upstream.url } }));

  describe("page that reads cookies(), headers() and searchParams", () => {
    it("is prerendered as fully static", () => {
      expect(clientOutputExists(FIXTURE, "request-apis.html")).toBe(true);
      expect(clientOutputExists(FIXTURE, "request-apis.rsc")).toBe(true);
      expect(readJsonOutput(FIXTURE, "request-apis.meta")).toEqual({ renderingMode: "STATIC" });
    });

    it("sees an empty request at build time", () => {
      const built = readClientOutput(FIXTURE, "request-apis.html");
      expect(textById(built, "user")).toBe("anonymous");
      expect(textById(built, "tag")).toBe("none");
      expect(textById(built, "q")).toBe("empty");
    });

    it("serves the build output and ignores the request's cookies, headers and query", async () => {
      const builtId = textById(readClientOutput(FIXTURE, "request-apis.html"), "render-id");
      const response = await app.fetch("/request-apis?q=runtime", {
        headers: { cookie: "user=ada", "x-e2e-tag": "runtime" },
      });
      expectStatic(response);
      const body = await html(response);

      expect(textById(body, "render-id")).toBe(builtId);
      expect(textById(body, "user")).toBe("anonymous");
      expect(textById(body, "tag")).toBe("none");
      expect(textById(body, "q")).toBe("empty");
    });
  });

  describe("page with an uncached fetch()", () => {
    it("bakes the build-time response and never calls the upstream at request time", async () => {
      const hitsAfterBuild = upstream.hits("/force-ssg-fetch");
      expect(hitsAfterBuild).toBe(1);

      const response = await app.fetch("/fetch");
      expectStatic(response);
      expect(textById(await response.text(), "hit")).toBe("1");
      await app.fetch("/fetch");

      expect(upstream.hits("/force-ssg-fetch")).toBe(hitsAfterBuild);
    });
  });

  describe("dynamic route with generateStaticParams", () => {
    it("prerenders every listed param", () => {
      expect(clientOutputExists(FIXTURE, "posts/one.html")).toBe(true);
      expect(clientOutputExists(FIXTURE, "posts/two.html")).toBe(true);
    });

    it("serves listed params from the build output, ignoring cookies", async () => {
      const response = await app.fetch("/posts/one", { headers: { cookie: "user=ada" } });
      expectStatic(response);
      const body = await response.text();
      expect(textById(body, "slug")).toBe("one");
      expect(textById(body, "user")).toBe("anonymous");
    });

    it("renders params that were not listed on demand", async () => {
      const response = await app.fetch("/posts/three", { headers: { cookie: "user=ada" } });
      expect(response.status).toBe(200);
      expectDynamic(response);
      const body = await response.text();
      expect(textById(body, "slug")).toBe("three");
      expect(textById(body, "user")).toBe("ada");
      expect(clientOutputExists(FIXTURE, "posts/three.html")).toBe(false);
    });
  });
});
