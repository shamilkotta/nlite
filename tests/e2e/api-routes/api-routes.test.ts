import { fileURLToPath } from "node:url";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApp, type E2EApp } from "../helpers/server.ts";

const fixtureDir = path.dirname(fileURLToPath(import.meta.url));

describe("api-routes", () => {
  let app: E2EApp;

  beforeAll(async () => {
    app = await createApp(fixtureDir);
  }, 120_000);

  afterAll(async () => {
    await app?.close();
  });

  it("serves JSON route handlers", async () => {
    const status = await app.fetch("/api/status");
    expect(status.response.status).toBe(200);
    expect(status.response.headers.get("content-type")).toMatch(/json/);
    const statusJson = JSON.parse(status.text) as { ok: boolean; ts: string };
    expect(statusJson.ok).toBe(true);
    expect(statusJson.ts).toMatch(/^\d{4}-/);
  });

  it("passes dynamic params to API handlers", async () => {
    const user = await app.fetch("/api/users/demo");
    expect(JSON.parse(user.text)).toEqual({ id: "demo" });
  });
});
