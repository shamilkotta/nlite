import { describe, expect, it } from "vitest";

import { clientOutputExists, useFixture } from "../harness/fixture.js";
import { textById } from "../harness/html.js";

const FIXTURE = "api-routes";

describe("route handlers (route.ts)", () => {
  const app = useFixture(FIXTURE);

  describe("methods", () => {
    it("handles GET with a JSON response", async () => {
      const response = await app.fetch("/api/hello");
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toMatch(/^application\/json/);
      expect(await response.json()).toEqual({ message: "hello" });
    });

    it.each(["POST", "PUT", "PATCH", "DELETE"])(
      "handles %s with the request body",
      async (method) => {
        const response = await app.fetch("/api/echo?page=2", {
          method,
          headers: { "x-e2e-tag": "tagged" },
          body: `${method} body`,
        });
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({
          method,
          body: `${method} body`,
          query: { page: "2" },
          header: "tagged",
        });
      },
    );

    // Known issue: Vite's preview server answers every OPTIONS request with its CORS
    // middleware before nlite sees it, so an exported OPTIONS handler never runs there.
    it("handles OPTIONS", async () => {
      const response = await app.fetch("/api/echo", { method: "OPTIONS" });
      expect(response.status).toBe(204);
      expect(response.headers.get("allow")).toBe("POST, PUT, PATCH, DELETE, OPTIONS");
    });

    it("handles an exported HEAD handler", async () => {
      const response = await app.fetch("/api/hello", { method: "HEAD" });
      expect(response.status).toBe(200);
      expect(response.headers.get("x-head")).toBe("yes");
      expect(await response.text()).toBe("");
    });

    it("responds 405 with an Allow header for a method the module does not export", async () => {
      const response = await app.fetch("/api/echo");
      expect(response.status).toBe(405);
      expect(response.headers.get("allow")).toBe("POST, PUT, PATCH, DELETE, OPTIONS");
      expect(await response.json()).toEqual({ message: "Method Not Allowed" });
    });

    it("responds 405 for POST to a GET-only handler", async () => {
      const response = await app.fetch("/api/hello", { method: "POST", body: "x" });
      expect(response.status).toBe(405);
      expect(response.headers.get("allow")).toBe("GET, HEAD");
    });
  });

  describe("params", () => {
    it("passes dynamic segments as params", async () => {
      expect(await (await app.fetch("/api/users/42")).json()).toEqual({ id: "42" });
    });

    it("passes catch-all segments as an array", async () => {
      const response = await app.fetch("/api/files/a/b/c.txt");
      expect(await response.json()).toEqual({ path: ["a", "b", "c.txt"] });
    });

    it("passes a single catch-all segment as a one-element array", async () => {
      expect(await (await app.fetch("/api/files/readme")).json()).toEqual({ path: ["readme"] });
    });
  });

  describe("requests and responses", () => {
    it("parses form data", async () => {
      const form = new FormData();
      form.append("name", "Ada");
      form.append("tag", "a");
      form.append("tag", "b");
      const response = await app.fetch("/api/form", { method: "POST", body: form });
      expect(await response.json()).toEqual({ name: "Ada", tags: ["a", "b"] });
    });

    it("keeps custom status codes and headers, including multiple set-cookie headers", async () => {
      const response = await app.fetch("/api/response?status=201");
      expect(response.status).toBe(201);
      expect(response.headers.get("x-custom")).toBe("custom-value");
      expect(response.headers.getSetCookie()).toEqual([
        "session=abc; Path=/; HttpOnly",
        "theme=dark; Path=/",
      ]);
      expect(await response.text()).toBe("status 201");
    });

    it("sends an empty 204 response", async () => {
      const response = await app.fetch("/api/response?status=204");
      expect(response.status).toBe(204);
      expect(await response.text()).toBe("");
    });

    it("streams a ReadableStream body", async () => {
      const response = await app.fetch("/api/stream");
      expect(await response.text()).toBe("one,two,three");
    });

    it("passes through redirect responses", async () => {
      const response = await app.fetch("/api/redirect");
      expect(response.status).toBe(302);
      expect(new URL(response.headers.get("location")!).pathname).toBe("/api/hello");
    });

    it("responds 500 when a handler throws", async () => {
      const response = await app.fetch("/api/throws");
      expect(response.status).toBe(500);
    });

    it("keeps serving after a handler throws", async () => {
      await app.fetch("/api/throws");
      expect((await app.fetch("/api/hello")).status).toBe(200);
    });
  });

  describe("routing", () => {
    it("serves handlers outside /api", async () => {
      const response = await app.fetch("/health");
      expect(response.status).toBe(200);
      expect(await response.text()).toBe("ok");
    });

    it("never prerenders route handlers", () => {
      expect(clientOutputExists(FIXTURE, "health.html")).toBe(false);
      expect(clientOutputExists(FIXTURE, "api/hello.html")).toBe(false);
    });

    it("serves pages and handlers side by side", async () => {
      expect(textById(await (await app.fetch("/sibling")).text(), "sibling")).toBe(
        "page next to a handler",
      );
      expect(await (await app.fetch("/api/sibling-handler")).json()).toEqual({ sibling: true });
    });

    it("falls back to the not-found page for unknown API paths requested as documents", async () => {
      const response = await app.fetch("/api/missing");
      expect(response.status).toBe(404);
      expect(response.headers.get("content-type")).toMatch(/^text\/html/);
    });

    it("returns an empty 404 for unknown API paths requested as JSON", async () => {
      const response = await app.fetch("/api/missing", { headers: { accept: "application/json" } });
      expect(response.status).toBe(404);
      expect(await response.text()).toBe("");
    });

    it("does not match a dynamic API segment across slashes", async () => {
      const response = await app.fetch("/api/users/42/posts", {
        headers: { accept: "application/json" },
      });
      expect(response.status).toBe(404);
    });
  });
});
