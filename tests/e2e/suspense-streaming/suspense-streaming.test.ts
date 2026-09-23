import { fileURLToPath } from "node:url";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApp, type E2EApp } from "../helpers/server.ts";

const fixtureDir = path.dirname(fileURLToPath(import.meta.url));

describe("suspense-streaming", () => {
  let app: E2EApp;

  beforeAll(async () => {
    app = await createApp(fixtureDir);
  }, 120_000);

  afterAll(async () => {
    await app?.close();
  });

  it("streams the shell before slow suspense content finishes", async () => {
    const response = await fetch(new URL("/", app.baseURL));
    expect(response.body).toBeTruthy();

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffered = "";
    let sawShell = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffered += decoder.decode(value, { stream: true });
      if (buffered.includes("shell-ready")) sawShell = true;
      if (sawShell && buffered.includes("slow-content-ready")) break;
    }

    expect(sawShell).toBe(true);
    expect(buffered).toContain("slow-content-ready");
  });
});
