import { describe, expect, it } from "vitest";

import { readClientOutput, useFixture } from "../harness/fixture.js";
import { useBrowser } from "../harness/browser.js";
import { links, metaContent, titleOf } from "../harness/html.js";
import { html } from "../harness/render.js";

const FIXTURE = "metadata";

describe("metadata", () => {
  const app = useFixture(FIXTURE);
  const browser = useBrowser();

  async function head(path: string) {
    const response = await app.fetch(path);
    expect(response.status, path).toBe(200);
    return html(response);
  }

  describe("title", () => {
    it("uses the layout's default title when the page has none", async () => {
      expect(titleOf(await head("/"))).toBe("Site");
      expect(titleOf(await head("/inherits"))).toBe("Site");
    });

    it("applies the parent layout's template to the page title", async () => {
      expect(titleOf(await head("/about"))).toBe("About | Site");
    });

    it("lets an absolute title skip the template", async () => {
      expect(titleOf(await head("/absolute"))).toBe("Standalone title");
    });

    it("applies the nearest layout's template", async () => {
      expect(titleOf(await head("/section/page-in-section"))).toBe("Nested · Section");
    });
  });

  describe("static metadata export", () => {
    it("renders the description, keywords and robots tags", async () => {
      const body = await head("/about");
      expect(metaContent(body, "description")).toBe("About us");
      expect(metaContent(body, "keywords")).toBe("nlite, e2e");
      expect(metaContent(body, "robots")).toBe("noindex, follow");
    });

    it("renders the canonical link", async () => {
      const canonical = links(await head("/about")).find((link) => link.rel === "canonical");
      expect(canonical?.href).toBe("https://example.com/about");
    });

    it("merges Open Graph fields from the layout and the page", async () => {
      const body = await head("/about");
      expect(metaContent(body, "og:title")).toBe("About OG");
      expect(metaContent(body, "og:site_name")).toBe("E2E Site");
      expect(metaContent(body, "og:type")).toBe("website");
      expect(metaContent(body, "og:image")).toBe("https://example.com/og.png");
      expect(metaContent(body, "og:image:alt")).toBe("OG image");
    });

    it("renders Twitter card tags", async () => {
      const body = await head("/about");
      expect(metaContent(body, "twitter:card")).toBe("summary_large_image");
      expect(metaContent(body, "twitter:site")).toBe("@nlite");
    });

    it("inherits the layout description when the page sets none", async () => {
      expect(metaContent(await head("/inherits"), "description")).toBe("Site description");
    });

    it("always renders charset and viewport tags", async () => {
      const body = await head("/");
      expect(body).toContain('<meta charSet="utf-8"/>');
      expect(metaContent(body, "viewport")).toBe("width=device-width, initial-scale=1");
    });
  });

  describe("generateMetadata", () => {
    it("receives params and is prerendered with the page", () => {
      const built = readClientOutput(FIXTURE, "posts/hello.html");
      expect(titleOf(built)).toBe("Post hello | Site");
      expect(metaContent(built, "description")).toBe("Read hello");
    });

    it("runs for params rendered on demand", async () => {
      const body = await head("/posts/other");
      expect(titleOf(body)).toBe("Post other | Site");
    });

    it("receives searchParams on dynamic pages", async () => {
      expect(titleOf(await head("/search?q=react"))).toBe("Search: react | Site");
      expect(titleOf(await head("/search"))).toBe("Search: all | Site");
    });

    it("receives the resolved parent metadata", async () => {
      const body = await head("/from-parent");
      expect(titleOf(body)).toBe("Child | Site");
      expect(metaContent(body, "description")).toBe("Site description (extended)");
    });
  });

  it("keeps the title after hydration", async () => {
    const { page } = await browser.open(app.url("/about"));
    expect(await page.title()).toBe("About | Site");
  });

  it("updates the document title on client navigation", async () => {
    const { page } = await browser.open(app.url("/about"));
    await page.evaluate(() => {
      const runtime = (globalThis as Record<string, unknown>).__NLITE_NAVIGATION_RUNTIME__ as {
        push(href: string): void;
      };
      runtime.push("/posts/hello");
    });
    await page.waitForURL(app.url("/posts/hello"));
    await page.waitForFunction(() => document.title === "Post hello | Site");
  });
});
