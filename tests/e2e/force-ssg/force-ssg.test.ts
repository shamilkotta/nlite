import { fileURLToPath } from "node:url";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApp, extractTestId, type E2EApp } from "../helpers/server.ts";

const fixtureDir = path.dirname(fileURLToPath(import.meta.url));

describe("force-ssg", () => {
  let app: E2EApp;

  beforeAll(async () => {
    app = await createApp(fixtureDir);
  }, 120_000);

  afterAll(async () => {
    await app?.close();
  });

  it("freezes output even when request APIs are used", async () => {
    const { first, second } = await app.fetchTwice("/?ref=live", {
      headers: { Cookie: "theme=dark" },
    });
    expect(extractTestId(first.text, "render-mode")).toBe("force-ssg");
    expect(extractTestId(first.text, "rendered-at")).toBe(
      extractTestId(second.text, "rendered-at"),
    );
    expect(extractTestId(first.text, "request-snapshot")).not.toContain('"theme":"dark"');
  });
});
