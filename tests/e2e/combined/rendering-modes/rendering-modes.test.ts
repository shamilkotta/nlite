import { fileURLToPath } from "node:url";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApp, extractTestId, type E2EApp } from "../../helpers/server.ts";

const fixtureDir = path.dirname(fileURLToPath(import.meta.url));

describe("combined: rendering-modes", () => {
  let app: E2EApp;

  beforeAll(async () => {
    app = await createApp(fixtureDir);
  }, 120_000);

  afterAll(async () => {
    await app?.close();
  });

  it("keeps auto-ssg frozen alongside force-ssg and force-ssr", async () => {
    const home = await app.fetchTwice("/");
    expect(extractTestId(home.first.text, "render-mode")).toBe("auto-ssg");
    expect(extractTestId(home.first.text, "rendered-at")).toBe(
      extractTestId(home.second.text, "rendered-at"),
    );

    const ssg = await app.fetchTwice("/force-ssg?ref=live", {
      headers: { Cookie: "theme=dark" },
    });
    expect(extractTestId(ssg.first.text, "render-mode")).toBe("force-ssg");
    expect(extractTestId(ssg.first.text, "rendered-at")).toBe(
      extractTestId(ssg.second.text, "rendered-at"),
    );
    expect(extractTestId(ssg.first.text, "theme")).not.toBe("dark");

    const ssr = await app.fetchTwice("/force-ssr");
    expect(extractTestId(ssr.first.text, "render-mode")).toBe("force-ssr");
    expect(extractTestId(ssr.first.text, "rendered-at")).not.toBe(
      extractTestId(ssr.second.text, "rendered-at"),
    );
  });
});
