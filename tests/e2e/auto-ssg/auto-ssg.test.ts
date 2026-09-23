import { fileURLToPath } from "node:url";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApp, extractTestId, type E2EApp } from "../helpers/server.ts";

const fixtureDir = path.dirname(fileURLToPath(import.meta.url));

describe("auto-ssg", () => {
  let app: E2EApp;

  beforeAll(async () => {
    app = await createApp(fixtureDir);
  }, 120_000);

  afterAll(async () => {
    await app?.close();
  });

  it("prerenders with a frozen timestamp across requests", async () => {
    const { first, second } = await app.fetchTwice("/");
    expect(first.response.status).toBe(200);
    expect(extractTestId(first.text, "render-mode")).toBe("auto-ssg");
    expect(extractTestId(first.text, "rendered-at")).toBe(
      extractTestId(second.text, "rendered-at"),
    );
  });
});
