import { describe, expect, it } from "vitest";

import { readClientOutput, useFixture } from "../harness/fixture.js";
import { textById } from "../harness/html.js";
import { expectStatic, html } from "../harness/render.js";

const FIXTURE = "use-cache";

describe('"use cache" (without PPR)', () => {
  const app = useFixture(FIXTURE);

  describe("in a static page", () => {
    it("runs at build time and ships the result with the page", async () => {
      const built = textById(readClientOutput(FIXTURE, "static.html"), "stamp");
      const response = await app.fetch("/static");
      expectStatic(response);
      expect(textById(await response.text(), "stamp")).toBe(built);
    });

    it("works on an async server component", async () => {
      const built = readClientOutput(FIXTURE, "component.html");
      expect(textById(built, "card-title")).toBe("Cached component");
      const body = await html(await app.fetch("/component"));
      expect(textById(body, "card-id")).toBe(textById(built, "card-id"));
    });
  });

  describe("in a dynamic page", () => {
    it("dedupes calls with the same arguments within one request", async () => {
      const body = await html(await app.fetch("/dynamic"));
      expect(textById(body, "first-a")).toMatch(/^a:/);
      expect(textById(body, "first-a")).toBe(textById(body, "second-a"));
    });

    it("keys results by arguments", async () => {
      const body = await html(await app.fetch("/dynamic"));
      expect(textById(body, "b")).toMatch(/^b:/);
      expect(textById(body, "b")).not.toBe(textById(body, "first-a"));
    });

    it("does not persist results across requests without PPR", async () => {
      const first = textById(await html(await app.fetch("/dynamic")), "first-a");
      const second = textById(await html(await app.fetch("/dynamic")), "first-a");
      expect(first).not.toBe(second);
    });

    it("treats object arguments with the same keys in any order as the same key", async () => {
      const body = await html(await app.fetch("/args"));
      expect(textById(body, "first")).toBe(textById(body, "reordered"));
      expect(textById(body, "different")).toMatch(/^red-2:/);
      expect(textById(body, "different")).not.toBe(textById(body, "first"));
    });

    it("fails the render when a cached function returns undefined", async () => {
      const response = await app.fetch("/undefined-result");
      expect(response.status).toBe(500);
      expect(app.logs()).toContain("returned undefined");
    });
  });
});
