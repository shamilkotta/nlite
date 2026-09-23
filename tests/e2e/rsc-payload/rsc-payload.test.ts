import { fileURLToPath } from "node:url";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApp, type E2EApp } from "../helpers/server.ts";

const fixtureDir = path.dirname(fileURLToPath(import.meta.url));

describe("rsc-payload", () => {
  let app: E2EApp;

  beforeAll(async () => {
    app = await createApp(fixtureDir);
  }, 120_000);

  afterAll(async () => {
    await app?.close();
  });

  it("serves RSC payloads at .rsc paths", async () => {
    const { response, text } = await app.fetch("/.rsc");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toMatch(/text\/x-component/);
    expect(text.length).toBeGreaterThan(0);
  });
});
