import { describe, expect, it } from "vitest";

import { buildFixture, useFixture } from "../harness/fixture.js";
import { textById, titleOf } from "../harness/html.js";

// generateMetadata that reads request data, or calls notFound()/redirect().
const FIXTURES = ["metadata-dynamic", "metadata-dynamic-ppr"] as const;

describe.each(FIXTURES)("dynamic generateMetadata (%s)", (fixture) => {
  // Fails with "Route used request-bound data during prerender" (no PPR) or
  // "Worker exited before completing renderRoute" (PPR), like awaiting searchParams in a page.
  it("builds when generateMetadata reads cookies()", async () => {
    const result = await buildFixture(fixture);
    expect(result.output).not.toMatch(/error during build/);
    expect(result.code).toBe(0);
  });

  describe("in dev", () => {
    const app = useFixture(fixture, "dev");

    it("uses request cookies in the title", async () => {
      const response = await app.fetch("/meta-cookies", { headers: { cookie: "user=ada" } });
      expect(response.status).toBe(200);
      const body = await response.text();
      expect(titleOf(body)).toBe("Hello ada");
      expect(textById(body, "meta-cookies")).toBe("Metadata reads cookies");
    });

    it("renders the page when generateMetadata lets it through", async () => {
      const response = await app.fetch("/meta-not-found", { headers: { cookie: "session=1" } });
      expect(response.status).toBe(200);
      expect(titleOf(await response.text())).toBe("Meta page");
    });

    it("answers 404 when generateMetadata calls notFound()", async () => {
      expect((await app.fetch("/meta-not-found")).status).toBe(404);
    });

    it("renders the not-found UI when generateMetadata calls notFound()", async () => {
      const body = await (await app.fetch("/meta-not-found")).text();
      expect(textById(body, "root-not-found")).toBe("Root not found");
    });

    it("answers 307 when generateMetadata calls redirect()", async () => {
      const response = await app.fetch("/meta-redirect");
      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe("/target?from=metadata");
    });

    it("answers 404 to the RSC request when generateMetadata calls notFound()", async () => {
      expect((await app.fetch("/meta-not-found.rsc")).status).toBe(404);
    });

    it("answers 404/307 for param-driven notFound()/redirect() in metadata", async () => {
      expect((await app.fetch("/meta-param/2")).status).toBe(404);
      expect((await app.fetch("/meta-param/old")).status).toBe(307);
    });

    it("renders param-driven metadata", async () => {
      const response = await app.fetch("/meta-param/1");
      expect(titleOf(await response.text())).toBe("Item 1");
    });
  });
});
