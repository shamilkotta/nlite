import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApp, extractTestId, type E2EApp } from "../helpers/server.ts";

const fixtureDir = path.dirname(fileURLToPath(import.meta.url));

describe("ppr preview resume", () => {
  let app: E2EApp;

  beforeAll(async () => {
    app = await createApp(fixtureDir);
  }, 120_000);

  afterAll(async () => {
    await app?.close();
  });

  it("keeps request data out of the prerendered shell", async () => {
    const shell = await readFile(path.join(app.fixtureDir, ".nlite/client/index.html"), "utf8");

    expect(extractTestId(shell, "ppr-shell")).toBe("ppr-shell");
    expect(extractTestId(shell, "ppr-cached")).toBe("cached-ok");
    expect(extractTestId(shell, "ppr-fallback")).toBe("ppr-loading");
    expect(shell).not.toContain("dynamic:");
    expect(shell).not.toContain("__NLITE_PUSH_RSC__");
  });

  it("resumes postponed holes with request data", async () => {
    const { text } = await app.fetch("/", {
      headers: { Cookie: "visitor=e2e" },
    });

    expect(extractTestId(text, "ppr-shell")).toBe("ppr-shell");
    expect(extractTestId(text, "ppr-cached")).toBe("cached-ok");
    expect(extractTestId(text, "ppr-dynamic")).toBe("dynamic:e2e");
    expect(text).toContain("__NLITE_PUSH_RSC__");
    expect(text).not.toMatch(/Minified React error #31|Objects are not valid as a React child/);
  });

  it("renders a fresh dynamic hole per request", async () => {
    const first = await app.fetch("/", {
      headers: { Cookie: "visitor=one" },
    });
    const second = await app.fetch("/", {
      headers: { Cookie: "visitor=two" },
    });

    expect(extractTestId(first.text, "ppr-dynamic")).toBe("dynamic:one");
    expect(extractTestId(second.text, "ppr-dynamic")).toBe("dynamic:two");
    expect(extractTestId(first.text, "ppr-shell")).toBe(extractTestId(second.text, "ppr-shell"));
  });
});
