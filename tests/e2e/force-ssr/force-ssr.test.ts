import { fileURLToPath } from "node:url";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApp, extractTestId, type E2EApp } from "../helpers/server.ts";

const fixtureDir = path.dirname(fileURLToPath(import.meta.url));

describe("force-ssr", () => {
  let app: E2EApp;

  beforeAll(async () => {
    app = await createApp(fixtureDir);
  }, 120_000);

  afterAll(async () => {
    await app?.close();
  });

  it("renders a fresh timestamp on every request", async () => {
    const { first, second } = await app.fetchTwice("/");
    expect(extractTestId(first.text, "render-mode")).toBe("force-ssr");
    expect(extractTestId(first.text, "rendered-at")).not.toBe(
      extractTestId(second.text, "rendered-at"),
    );
  });
});
