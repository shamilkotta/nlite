import { fileURLToPath } from "node:url";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApp, extractTestId, type E2EApp } from "../helpers/server.ts";

const fixtureDir = path.dirname(fileURLToPath(import.meta.url));

describe("generateStaticParams", () => {
  let app: E2EApp;

  beforeAll(async () => {
    app = await createApp(fixtureDir);
  }, 120_000);

  afterAll(async () => {
    await app?.close();
  });

  it("prerenders listed params", async () => {
    const { first, second } = await app.fetchTwice("/alpha");
    expect(extractTestId(first.text, "render-mode")).toBe("ssg-prebuilt");
    expect(extractTestId(first.text, "rendered-at")).toBe(
      extractTestId(second.text, "rendered-at"),
    );
  });

  it("SSRs unknown params with live searchParams", async () => {
    const { first, second } = await app.fetchTwice("/gamma?view=grid");
    expect(extractTestId(first.text, "render-mode")).toBe("ssg-dynamic");
    expect(extractTestId(first.text, "view")).toBe("grid");
    expect(extractTestId(first.text, "rendered-at")).not.toBe(
      extractTestId(second.text, "rendered-at"),
    );
  });
});
