import { describe, expect, it } from "vitest";

import { clientOutputExists, useFixture } from "../harness/fixture.js";
import { textById } from "../harness/html.js";
import { expectDynamic, html } from "../harness/render.js";
import { useUpstream } from "../harness/upstream.js";

const FIXTURE = "ssr";

describe("server-side rendering", () => {
  const upstream = useUpstream();
  const app = useFixture(FIXTURE, "preview", () => ({ env: { UPSTREAM_URL: upstream.url } }));

  it("does not write build output for routes that read request data", () => {
    for (const route of ["cookies", "headers", "fetch", "dynamic-layout/child"]) {
      expect(clientOutputExists(FIXTURE, `${route}.html`), route).toBe(false);
    }
  });

  it("responds with streamed html, a dynamic stale time and no ETag", async () => {
    const response = await app.fetch("/cookies");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/html;charset=utf-8");
    expect(response.headers.get("x-nlite-staletime")).toBe("0");
    expect(response.headers.get("etag")).toBeNull();
  });

  it("renders a fresh result for every request", async () => {
    const first = textById(await html(await app.fetch("/cookies")), "render-id");
    const second = textById(await html(await app.fetch("/cookies")), "render-id");
    expect(first).toBeTruthy();
    expect(first).not.toBe(second);
  });

  describe("cookies()", () => {
    it("reads the request cookie", async () => {
      const body = await html(await app.fetch("/cookies", { headers: { cookie: "user=ada" } }));
      expect(textById(body, "user")).toBe("ada");
    });

    it("falls back when the cookie is absent", async () => {
      const body = await html(await app.fetch("/cookies"));
      expect(textById(body, "user")).toBe("anonymous");
      expect(textById(body, "has-theme")).toBe("false");
      expect(textById(body, "all")).toBe("");
    });

    it("isolates cookies between concurrent requests", async () => {
      const users = ["u1", "u2", "u3", "u4", "u5", "u6"];
      const bodies = await Promise.all(
        users.map(async (user) =>
          html(await app.fetch("/cookies", { headers: { cookie: `user=${user}` } })),
        ),
      );
      expect(bodies.map((body) => textById(body, "user"))).toEqual(users);
    });

    it("parses multiple cookies and supports has() and getAll()", async () => {
      const body = await html(
        await app.fetch("/cookies", { headers: { cookie: "user=ada; theme=dark;  lang=en" } }),
      );
      expect(textById(body, "has-theme")).toBe("true");
      expect(textById(body, "all")).toBe("user=ada;theme=dark;lang=en");
    });

    it("decodes percent-encoded cookie values and keeps '=' inside values", async () => {
      const body = await html(
        await app.fetch("/cookies", { headers: { cookie: "user=J%C3%BCrgen%20M; theme=a=b" } }),
      );
      expect(textById(body, "user")).toBe("Jürgen M");
      expect(textById(body, "all")).toContain("theme=a=b");
    });
  });

  describe("headers()", () => {
    it("reads request headers", async () => {
      const body = await html(await app.fetch("/headers", { headers: { "x-e2e-tag": "blue" } }));
      expect(textById(body, "tag")).toBe("blue");
    });

    it("returns null for a missing header", async () => {
      const body = await html(await app.fetch("/headers"));
      expect(textById(body, "tag")).toBe("none");
    });

    it("makes a route dynamic when a layout reads headers()", async () => {
      const response = await app.fetch("/dynamic-layout/child", {
        headers: { "x-e2e-tag": "from-layout" },
      });
      expectDynamic(response);
      expect(textById(await response.text(), "layout-tag")).toBe("from-layout");
    });
  });

  describe("fetch()", () => {
    it("calls the upstream on every request", async () => {
      const before = upstream.hits("/ssr-fetch");
      const first = textById(await html(await app.fetch("/fetch")), "hit");
      const second = textById(await html(await app.fetch("/fetch")), "hit");
      expect(Number(first)).toBe(before + 1);
      expect(Number(second)).toBe(before + 2);
    });
  });

  describe("dynamic segments", () => {
    it("passes the segment value as a param", async () => {
      const response = await app.fetch("/users/42");
      expectDynamic(response);
      expect(textById(await response.text(), "user-id")).toBe("42");
    });

    it("decodes percent-encoded params", async () => {
      const body = await html(await app.fetch("/users/caf%C3%A9%20au%20lait"));
      expect(textById(body, "user-id")).toBe("café au lait");
    });

    it("does not match a dynamic segment across slashes", async () => {
      const response = await app.fetch("/users/42/extra");
      expect(response.status).toBe(404);
    });

    it("passes catch-all segments as an array", async () => {
      const body = await html(await app.fetch("/files/a/b/c.txt"));
      expect(JSON.parse(textById(body, "path")!)).toEqual(["a", "b", "c.txt"]);
    });

    it("does not match a catch-all route without any segment", async () => {
      const response = await app.fetch("/files");
      expect(response.status).toBe(404);
    });
  });

  describe("RSC payload", () => {
    it("renders the payload on demand with the dynamic stale time", async () => {
      const response = await app.fetch("/cookies.rsc", { headers: { cookie: "user=rsc-user" } });
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("text/x-component;charset=utf-8");
      expect(response.headers.get("x-nlite-staletime")).toBe("0");
      expect(response.headers.get("x-nlite-status")).toBe("200");
      expect(await response.text()).toContain("rsc-user");
    });
  });
});
