import { describe, expect, it } from "vitest";

import { clientOutputExists, readClientOutput, useFixture } from "../harness/fixture.js";
import { textById } from "../harness/html.js";

describe("configuration", () => {
  describe("appDir", () => {
    const FIXTURE = "config-app-dir";
    const app = useFixture(FIXTURE);

    it("routes pages from the configured directory", async () => {
      expect(textById(await (await app.fetch("/")).text(), "home")).toBe("From src/routes");
      expect(textById(await (await app.fetch("/about")).text(), "about")).toBe(
        "About from src/routes",
      );
    });

    it("prerenders pages from the configured directory", () => {
      expect(clientOutputExists(FIXTURE, "about.html")).toBe(true);
    });

    it("routes handlers from the configured directory", async () => {
      expect(await (await app.fetch("/api/ping")).json()).toEqual({ from: "src/routes" });
    });

    it("ignores the default app/ directory", async () => {
      expect((await app.fetch("/ignored")).status).toBe(404);
      expect(clientOutputExists(FIXTURE, "ignored.html")).toBe(false);
    });
  });

  describe("function config with vite passthrough", () => {
    const FIXTURE = "config-function";
    const app = useFixture(FIXTURE);

    it("receives the command (build) when building", () => {
      expect(readClientOutput(FIXTURE, "_headers")).toContain("x-nlite-staletime: 11");
    });

    it("applies vite.resolve.alias", async () => {
      expect(textById(await (await app.fetch("/")).text(), "greeting")).toBe("hello from alias");
    });

    it("applies vite.define with the resolved mode", async () => {
      expect(textById(await (await app.fetch("/")).text(), "mode")).toBe("production");
    });
  });

  describe("function config in dev", () => {
    const app = useFixture("config-function", "dev");

    it("receives the command (serve) and the development mode", async () => {
      expect(textById(await (await app.fetch("/")).text(), "mode")).toBe("development");
    });
  });

  describe("no config file", () => {
    const FIXTURE = "config-none";
    const app = useFixture(FIXTURE);

    it("builds and serves with the defaults", async () => {
      expect(textById(await (await app.fetch("/")).text(), "home")).toBe("No config");
      expect(clientOutputExists(FIXTURE, "about.html")).toBe(true);
    });

    it("uses the default stale times", () => {
      const headers = readClientOutput(FIXTURE, "_headers");
      expect(headers).toContain("/*.rsc\n  x-nlite-staletime: 300");
      expect(headers).toContain("/_not-found.rsc\n  x-nlite-staletime: 0");
    });

    it("does not enable PPR", () => {
      expect(readClientOutput(FIXTURE, "about.meta")).toContain('"renderingMode":"STATIC"');
    });
  });

  describe("nlite.config.mjs", () => {
    const FIXTURE = "config-mjs";
    const app = useFixture(FIXTURE);

    it("is picked up", async () => {
      expect(readClientOutput(FIXTURE, "_headers")).toContain("x-nlite-staletime: 5");
      expect(textById(await (await app.fetch("/")).text(), "home")).toBe("mjs config");
    });
  });
});
