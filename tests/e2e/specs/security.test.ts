import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { fixtureDir, useFixture } from "../harness/fixture.js";
import { useBrowser } from "../harness/browser.js";
import { textById } from "../harness/html.js";

const FIXTURE = "security";
const XSS = "<script>alert(1)</script>";
const SCRIPT_BREAKOUT = "</script><script>alert(2)</script>";

/** Raw request so paths like `/../` or `%2e%2e` reach the server unnormalized. */
async function rawGet(origin: string, rawPath: string) {
  const { request } = await import("node:http");
  const url = new URL(origin);
  return new Promise<{ status: number; body: string }>((resolve, reject) => {
    const req = request(
      { host: url.hostname, port: url.port, path: rawPath, method: "GET" },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body }));
      },
    );
    req.on("error", reject);
    req.end();
  });
}

describe("security", () => {
  const app = useFixture(FIXTURE);
  const browser = useBrowser();

  describe("escaping request data", () => {
    it("escapes cookie values rendered as text", async () => {
      const body = await (
        await app.fetch("/echo", { headers: { cookie: `name=${encodeURIComponent(XSS)}` } })
      ).text();
      expect(body).not.toContain(XSS);
      expect(body).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    });

    it("escapes header values rendered as text", async () => {
      const body = await (await app.fetch("/echo", { headers: { "x-name": XSS } })).text();
      expect(body).not.toContain(XSS);
    });

    it("escapes route params", async () => {
      const body = await (await app.fetch(`/users/${encodeURIComponent(XSS)}`)).text();
      expect(body).not.toContain(XSS);
      // textById decodes entities, so the text round-trips while the raw markup is absent.
      expect(textById(body, "user-id")).toBe(XSS);
    });

    it("cannot break out of the inline RSC payload script", async () => {
      const body = await (
        await app.fetch("/client-echo", {
          headers: { cookie: `name=${encodeURIComponent(SCRIPT_BREAKOUT)}` },
        })
      ).text();
      expect(body).not.toContain(SCRIPT_BREAKOUT);
    });

    it("escapes values streamed into a resumed PPR hole", async () => {
      const body = await (
        await app.fetch("/partial", { headers: { cookie: `name=${encodeURIComponent(XSS)}` } })
      ).text();
      expect(body).not.toContain(XSS);
    });

    it("blocks javascript: URLs in href attributes", async () => {
      const body = await (
        await app.fetch("/echo", { headers: { cookie: "href=javascript:alert(1)" } })
      ).text();
      expect(body).not.toContain('href="javascript:alert(1)"');
    });

    it("does not execute injected scripts in the browser", async () => {
      const { page, errors } = await browser.open(app.url("/client-echo"), {
        cookies: { name: encodeURIComponent(SCRIPT_BREAKOUT) },
      });
      let dialog = false;
      page.on("dialog", async (event) => {
        dialog = true;
        await event.dismiss();
      });
      await page.locator("#client-value").waitFor();
      await page.waitForTimeout(200);
      expect(dialog).toBe(false);
      expect(await page.locator("#client-value").textContent()).toBe(SCRIPT_BREAKOUT);
      expect(errors).toEqual([]);
    });
  });

  describe("path traversal and source files", () => {
    const attempts = [
      "/../package.json",
      "/..%2f..%2fpackage.json",
      "/%2e%2e/%2e%2e/package.json",
      "/_nlite/..%2f..%2fnlite.config.ts",
      "/_nlite/../.nlite/server/index.js",
      "/..%2f.env",
      "/.env",
      "/nlite.config.ts",
      "/app/page.tsx",
      "/.nlite/server/index.js",
    ];

    for (const attempt of attempts) {
      it(`does not serve ${attempt}`, async () => {
        const { status, body } = await rawGet(app.origin, attempt);
        expect(status).toBe(404);
        expect(body).not.toContain("dont-leak-me");
        expect(body).not.toContain("defineConfig");
        expect(body).not.toContain('"name": "nlite-e2e"');
      });
    }

    it("serves files from public/", async () => {
      const response = await app.fetch("/hello.txt");
      expect(response.status).toBe(200);
      expect(await response.text()).toBe("public file\n");
    });
  });

  describe("secrets", () => {
    it("keeps .env values out of the client output", () => {
      const clientDir = path.join(fixtureDir(FIXTURE), ".nlite", "client");
      const walk = (dir: string): string[] =>
        readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
          entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)],
        );
      for (const file of walk(clientDir)) {
        expect(readFileSync(file, "utf8"), file).not.toContain("dont-leak-me");
      }
    });

    it("does not publicly serve the PPR postponed state (.meta)", async () => {
      expect((await app.fetch("/partial.meta")).status).toBe(404);
    });

    it("does not publicly serve build metadata for static pages (.meta)", async () => {
      expect((await app.fetch("/index.meta")).status).toBe(404);
    });
  });

  describe("malformed input", () => {
    it("answers 404 for a malformed percent-encoding in a static path", async () => {
      expect((await rawGet(app.origin, "/%E0%A4%A")).status).toBe(404);
      expect((await rawGet(app.origin, "/%")).status).toBe(404);
    });

    it("answers 400 or 404 for a malformed percent-encoding in a dynamic param", async () => {
      expect([400, 404]).toContain((await rawGet(app.origin, "/users/%E0%A4%A")).status);
    });

    it("does not leak a stack trace for a malformed param", async () => {
      const { body } = await rawGet(app.origin, "/users/%E0%A4%A");
      expect(body).not.toContain("URIError");
      expect(body).not.toContain(".nlite/server");
    });

    it("keeps serving after malformed requests", async () => {
      await rawGet(app.origin, "/users/%E0%A4%A");
      await rawGet(app.origin, "/%");
      expect((await app.fetch("/")).status).toBe(200);
    });

    it("hands malformed query strings to route handlers without crashing", async () => {
      const { status } = await rawGet(app.origin, "/api/echo?q=%E0%A4%A");
      expect(status).toBe(200);
    });

    it("ignores a forged resume request for a page without postponed state", async () => {
      const response = await app.fetch("/echo", {
        method: "POST",
        headers: { "x-nlite-resume": "1" },
        body: '{"postponed":null}',
      });
      expect(response.status).toBeLessThan(500);
    });
  });
});
