import { fileURLToPath } from "node:url";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApp, extractTestId, type E2EApp } from "../../helpers/server.ts";

const fixtureDir = path.dirname(fileURLToPath(import.meta.url));

describe("combined: suspense-with-cookies", () => {
  let app: E2EApp;

  beforeAll(async () => {
    app = await createApp(fixtureDir);
  }, 120_000);

  afterAll(async () => {
    await app?.close();
  });

  it("renders suspense content that reads cookies at request time", async () => {
    const { text } = await app.fetch("/", {
      headers: { Cookie: "visitor=e2e" },
    });
    expect(extractTestId(text, "ppr-shell")).toBe("ppr-shell");
    expect(extractTestId(text, "ppr-dynamic")).toBe("dynamic:e2e");
  });
});
