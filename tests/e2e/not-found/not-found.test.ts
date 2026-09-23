import { fileURLToPath } from "node:url";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApp, extractTestId, type E2EApp } from "../helpers/server.ts";

const fixtureDir = path.dirname(fileURLToPath(import.meta.url));

describe("not-found", () => {
  let app: E2EApp;

  beforeAll(async () => {
    app = await createApp(fixtureDir);
  }, 120_000);

  afterAll(async () => {
    await app?.close();
  });

  it("renders custom not-found.tsx for unknown routes", async () => {
    const { response, text } = await app.fetch("/does-not-exist");
    expect(response.status).toBe(404);
    expect(extractTestId(text, "not-found-page")).toContain("Custom Not Found");
  });

  it("supports notFound() from a page", async () => {
    const { response, text } = await app.fetch("/trigger");
    expect(response.status).toBe(404);
    expect(text).toMatch(/404: This page could not be found/i);
  });
});
