import { describe, expect, it } from "vitest";

import {
  clientOutputExists,
  readClientOutput,
  readJsonOutput,
  useFixture,
} from "../harness/fixture.js";
import { textById } from "../harness/html.js";
import { expectDynamic, expectStatic, html } from "../harness/render.js";

const FIXTURE = "ppr-ssr";

describe("PPR combined with SSR and SSG routes", () => {
  const app = useFixture(FIXTURE);

  describe('rendering = "force-ssr" with ppr enabled', () => {
    it("does not prerender a shell", () => {
      expect(clientOutputExists(FIXTURE, "force-ssr.html")).toBe(false);
      expect(clientOutputExists(FIXTURE, "force-ssr.meta")).toBe(false);
    });

    it("renders shell and Suspense content on every request", async () => {
      const first = await app.fetch("/force-ssr", { headers: { cookie: "user=ada" } });
      expectDynamic(first);
      const firstHtml = await html(first);
      const secondHtml = await html(await app.fetch("/force-ssr"));

      expect(textById(firstHtml, "hole-user")).toBe("ada");
      expect(textById(secondHtml, "hole-user")).toBe("anonymous");
      expect(textById(firstHtml, "shell-id")).not.toBe(textById(secondHtml, "shell-id"));
    });

    it("renders a page without request APIs per request", async () => {
      expect(clientOutputExists(FIXTURE, "force-ssr-static.html")).toBe(false);
      const first = textById(await html(await app.fetch("/force-ssr-static")), "render-id");
      const second = textById(await html(await app.fetch("/force-ssr-static")), "render-id");
      expect(first).not.toBe(second);
    });
  });

  describe('rendering = "force-ssg" with ppr enabled', () => {
    it("prerenders the whole page, including the Suspense boundary, as static", () => {
      const meta = readJsonOutput<{ renderingMode: string; postponed?: unknown }>(
        FIXTURE,
        "force-ssg.meta",
      );
      expect(meta.renderingMode).toBe("STATIC");
      expect(meta.postponed).toBeUndefined();
      expect(clientOutputExists(FIXTURE, "force-ssg.rsc")).toBe(true);

      const built = readClientOutput(FIXTURE, "force-ssg.html");
      expect(textById(built, "hole-user")).toBe("anonymous");
    });

    it("serves the build output without resuming, ignoring the request's cookies", async () => {
      const builtId = textById(readClientOutput(FIXTURE, "force-ssg.html"), "shell-id");
      const response = await app.fetch("/force-ssg", { headers: { cookie: "user=ada" } });
      expectStatic(response);
      expect(response.headers.get("transfer-encoding")).toBeNull();
      const body = await html(response);
      expect(textById(body, "shell-id")).toBe(builtId);
      expect(textById(body, "hole-user")).toBe("anonymous");
    });
  });

  describe("dynamic segment without generateStaticParams", () => {
    it("is rendered on demand", async () => {
      expect(clientOutputExists(FIXTURE, "users")).toBe(false);
      const response = await app.fetch("/users/7");
      expectDynamic(response);
      expect(textById(await html(response), "user-id")).toBe("7");
    });
  });

  describe("generateStaticParams with a dynamic hole", () => {
    // Params returned by generateStaticParams are always force-prerendered, PPR or not.
    it("prerenders listed params fully, including the boundary that reads cookies", () => {
      for (const slug of ["alpha", "beta"]) {
        const meta = readJsonOutput<{ renderingMode: string }>(FIXTURE, `posts/${slug}.meta`);
        expect(meta.renderingMode, slug).toBe("STATIC");
        const built = readClientOutput(FIXTURE, `posts/${slug}.html`);
        expect(textById(built, "slug")).toBe(slug);
        expect(textById(built, "viewer")).toBe(`${slug}:anonymous`);
      }
    });

    it("serves listed params from the build output, ignoring the request's cookies", async () => {
      const shellId = textById(readClientOutput(FIXTURE, "posts/beta.html"), "shell-id");
      const response = await app.fetch("/posts/beta", { headers: { cookie: "user=reader" } });
      expectStatic(response);
      const body = await html(response);
      expect(textById(body, "shell-id")).toBe(shellId);
      expect(textById(body, "viewer")).toBe("beta:anonymous");
    });

    it("renders unlisted params fully on demand", async () => {
      const response = await app.fetch("/posts/gamma", { headers: { cookie: "user=reader" } });
      expectDynamic(response);
      expect(textById(await html(response), "viewer")).toBe("gamma:reader");
      expect(clientOutputExists(FIXTURE, "posts/gamma.html")).toBe(false);
    });
  });

  describe("other features keep working with ppr enabled", () => {
    it("serves route handlers", async () => {
      const response = await app.fetch("/api/ping");
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ pong: true });
    });

    it("responds 404 for unknown routes", async () => {
      expect((await app.fetch("/missing")).status).toBe(404);
    });
  });
});
