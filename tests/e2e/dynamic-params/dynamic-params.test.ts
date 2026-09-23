import { fileURLToPath } from "node:url";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApp, extractTestId, type E2EApp } from "../helpers/server.ts";

const fixtureDir = path.dirname(fileURLToPath(import.meta.url));

describe("dynamic-params", () => {
  let app: E2EApp;

  beforeAll(async () => {
    app = await createApp(fixtureDir);
  }, 120_000);

  afterAll(async () => {
    await app?.close();
  });

  it("SSRs unfixed dynamic segments per request", async () => {
    const { first, second } = await app.fetchTwice("/users/alice");
    expect(extractTestId(first.text, "user-id")).toBe("alice");
    expect(extractTestId(first.text, "rendered-at")).not.toBe(
      extractTestId(second.text, "rendered-at"),
    );
  });
});
