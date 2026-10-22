import { chromium, type Browser, type BrowserContext, type Page, type Request } from "playwright";
import { afterAll, afterEach, beforeAll } from "vitest";

export interface BrowserPage {
  page: Page;
  /** Console errors and uncaught page errors seen so far. */
  errors: string[];
  /** Every request URL the page has made so far. */
  requests: string[];
  /** Pathnames (with search) of `.rsc` requests the page has made so far. */
  rscRequests(): string[];
}

/** One Chromium per test file; call `open()` in each test for an isolated context. */
export function useBrowser() {
  let browser: Browser | undefined;
  const contexts: BrowserContext[] = [];

  beforeAll(async () => {
    browser = await chromium.launch();
  });

  afterEach(async () => {
    await Promise.all(contexts.splice(0).map((context) => context.close()));
  });

  afterAll(async () => {
    await browser?.close();
  });

  return {
    async open(url: string, options: { cookies?: Record<string, string> } = {}): Promise<BrowserPage> {
      const context = await browser!.newContext();
      contexts.push(context);

      if (options.cookies) {
        await context.addCookies(
          Object.entries(options.cookies).map(([name, value]) => ({ name, value, url })),
        );
      }

      const page = await context.newPage();
      const errors: string[] = [];
      const requests: string[] = [];

      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("request", (request: Request) => requests.push(request.url()));

      await page.goto(url);
      await waitForHydration(page);

      return {
        page,
        errors,
        requests,
        rscRequests: () =>
          requests
            .map((request) => new URL(request))
            .filter((request) => request.pathname.endsWith(".rsc"))
            .map((request) => request.pathname + request.search),
      };
    },
  };
}

/** Resolves once nlite's client runtime has hydrated the document and installed the router. */
export async function waitForHydration(page: Page) {
  await page.waitForFunction(() => "__NLITE_NAVIGATION_RUNTIME__" in globalThis, undefined, {
    timeout: 15_000,
  });
}

/** Sets a marker on `window` that only survives client-side (non-reloading) navigations. */
export async function markWindow(page: Page) {
  await page.evaluate(() => {
    (window as unknown as { __e2eMarker?: number }).__e2eMarker = 1;
  });
}

export async function windowMarkerSurvived(page: Page) {
  return page.evaluate(() => (window as unknown as { __e2eMarker?: number }).__e2eMarker === 1);
}
