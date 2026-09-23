import { fileURLToPath } from "node:url";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApp, type E2EApp } from "../helpers/server.ts";

const fixtureDir = path.dirname(fileURLToPath(import.meta.url));

describe("redirect", () => {
  let app: E2EApp;

  beforeAll(async () => {
    app = await createApp(fixtureDir);
  }, 120_000);

  afterAll(async () => {
    await app?.close();
  });

  it("renders a redirect shell via redirect()", async () => {
    const { response, text } = await app.fetch("/go");
    expect(response.status).toBe(200);
    expect(text).toMatch(/url=\//i);
    expect(text).toMatch(/Redirecting/i);
  });
});
