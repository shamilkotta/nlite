import { describe, expect, it } from "vitest";

import { readClientOutput, useFixture } from "../harness/fixture.js";
import { useBrowser } from "../harness/browser.js";
import { hasId, textById } from "../harness/html.js";

const FIXTURE = "loading";

/** Reads a streamed response and records the index of the chunk where each marker first appears. */
async function readChunks(response: Response, markers: string[]) {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  const firstSeen = new Map<string, number>();
  let body = "";
  let chunkIndex = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    body += decoder.decode(value, { stream: true });
    for (const marker of markers) {
      if (!firstSeen.has(marker) && body.includes(marker)) firstSeen.set(marker, chunkIndex);
    }
    chunkIndex += 1;
  }

  return { body, firstSeen };
}

describe("loading.tsx", () => {
  const app = useFixture(FIXTURE);
  const browser = useBrowser();

  it("streams the loading UI before the page content is ready", async () => {
    const response = await app.fetch("/slow");
    expect(response.status).toBe(200);

    const { body, firstSeen } = await readChunks(response, ['id="loading"', 'id="content"']);
    expect(firstSeen.get('id="loading"')).toBeDefined();
    expect(firstSeen.get('id="content"')).toBeDefined();
    expect(firstSeen.get('id="loading"')!).toBeLessThan(firstSeen.get('id="content"')!);
    expect(textById(body, "content")).toBe("Slow content");
  });

  it("uses a parent segment's loading.tsx for nested pages", async () => {
    const { body, firstSeen } = await readChunks(await app.fetch("/parent/child"), [
      'id="parent-loading"',
      'id="child-content"',
    ]);
    expect(firstSeen.get('id="parent-loading"')!).toBeLessThan(
      firstSeen.get('id="child-content"')!,
    );
    expect(textById(body, "child-content")).toBe("Child content");
  });

  it("prerenders static pages fully, without the loading UI", () => {
    const built = readClientOutput(FIXTURE, "static.html");
    expect(textById(built, "content")).toBe("Static content");
    expect(hasId(built, "loading")).toBe(false);
  });

  it("swaps the loading UI for the content in the browser", async () => {
    const { page } = await browser.open(app.url("/slow"));
    await page.locator("#content").waitFor();
    expect(await page.locator("#loading").count()).toBe(0);
  });
});
