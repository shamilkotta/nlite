import { fileURLToPath } from "node:url";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApp, extractTestId, type E2EApp } from "../helpers/server.ts";

const fixtureDir = path.dirname(fileURLToPath(import.meta.url));

describe("headers-cookies", () => {
  let app: E2EApp;

  beforeAll(async () => {
    app = await createApp(fixtureDir);
  }, 120_000);

  afterAll(async () => {
    await app?.close();
  });

  it("exposes live headers, cookies, and searchParams", async () => {
    const { text } = await app.fetch("/?ref=e2e", {
      headers: {
        Cookie: "theme=sepia",
        "x-test": "probe",
      },
    });
    expect(extractTestId(text, "query-ref")).toBe("e2e");
    expect(extractTestId(text, "cookie-theme")).toBe("sepia");
    expect(extractTestId(text, "header-x-test")).toBe("probe");
  });
});
