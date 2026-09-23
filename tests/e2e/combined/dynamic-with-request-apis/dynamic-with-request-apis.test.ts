import { fileURLToPath } from "node:url";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApp, extractTestId, type E2EApp } from "../../helpers/server.ts";

const fixtureDir = path.dirname(fileURLToPath(import.meta.url));

describe("combined: dynamic-with-request-apis", () => {
  let app: E2EApp;

  beforeAll(async () => {
    app = await createApp(fixtureDir);
  }, 120_000);

  afterAll(async () => {
    await app?.close();
  });

  it("SSRs dynamic segments with live headers and cookies", async () => {
    const { first, second } = await app.fetchTwice("/users/alice", {
      headers: {
        Cookie: "theme=dark; visitor=alice",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    expect(extractTestId(first.text, "user-id")).toBe("alice");
    expect(extractTestId(first.text, "theme")).toBe("dark");
    expect(extractTestId(first.text, "visitor")).toBe("alice");
    expect(extractTestId(first.text, "accept-language")).toBe("en-US");
    expect(extractTestId(first.text, "rendered-at")).not.toBe(
      extractTestId(second.text, "rendered-at"),
    );
  });
});
