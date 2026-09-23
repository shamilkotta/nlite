import { fileURLToPath } from "node:url";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApp, extractTestId, type E2EApp } from "../helpers/server.ts";

const fixtureDir = path.dirname(fileURLToPath(import.meta.url));

describe("nested-layout", () => {
  let app: E2EApp;

  beforeAll(async () => {
    app = await createApp(fixtureDir);
  }, 120_000);

  afterAll(async () => {
    await app?.close();
  });

  it("composes nested layouts around child pages", async () => {
    const { text } = await app.fetch("/nested/child");
    expect(extractTestId(text, "nested-layout-label")).toBe("nested-layout");
    expect(extractTestId(text, "nested-child-page")).toContain("Nested child");
  });
});
