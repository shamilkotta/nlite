import { describe, expect, it } from "vitest";

import { clientOutputExists, useFixture } from "../harness/fixture.js";
import { hasId, textById, withoutFlight } from "../harness/html.js";
import { html } from "../harness/render.js";

const FIXTURE = "layouts";

/** Asserts that the ids appear in the html in the given order (outermost first). */
function expectNested(body: string, ids: string[]) {
  const positions = ids.map((id) => body.indexOf(`id="${id}"`));
  for (const [index, position] of positions.entries()) {
    expect(position, `#${ids[index]} is missing`).toBeGreaterThanOrEqual(0);
  }
  expect(positions).toEqual([...positions].sort((left, right) => left - right));
}

async function page(app: { fetch(path: string): Promise<Response> }, path: string) {
  const response = await app.fetch(path);
  expect(response.status, path).toBe(200);
  return withoutFlight(await html(response));
}

describe("layouts", () => {
  const app = useFixture(FIXTURE);

  it("wraps every page in the root layout", async () => {
    for (const path of ["/", "/dashboard", "/cart", "/about", "/teams/core"]) {
      const body = await page(app, path);
      expect(textById(body, "root-header"), path).toBe("Site header");
    }
  });

  it("nests segment layouts from the root down to the page", async () => {
    const body = await page(app, "/dashboard/settings");
    expectNested(body, [
      "root-layout",
      "dashboard-layout",
      "dashboard-nav",
      "settings-layout",
      "settings-page",
    ]);
  });

  it("applies a segment layout only to its own subtree", async () => {
    const dashboard = await page(app, "/dashboard");
    expect(hasId(dashboard, "dashboard-layout")).toBe(true);
    expect(hasId(dashboard, "settings-layout")).toBe(false);

    const home = await page(app, "/");
    expect(hasId(home, "dashboard-layout")).toBe(false);
  });

  describe("route groups", () => {
    it("applies the group's layout to every route in the group", async () => {
      expectNested(await page(app, "/cart"), ["root-layout", "shop-layout", "cart-page"]);
      expectNested(await page(app, "/checkout"), ["root-layout", "shop-layout", "checkout-page"]);
    });

    it("does not apply the group's layout to routes in other groups", async () => {
      const body = await page(app, "/about");
      expect(hasId(body, "about-page")).toBe(true);
      expect(hasId(body, "shop-layout")).toBe(false);
    });

    it("keeps the group name out of the URL", async () => {
      expect((await app.fetch("/(shop)/cart")).status).toBe(404);
      expect((await app.fetch("/shop/cart")).status).toBe(404);
    });
  });

  describe("dynamic segments", () => {
    it("passes params to the layout and the page", async () => {
      const body = await page(app, "/teams/core");
      expect(textById(body, "layout-team")).toBe("core");
      expect(textById(body, "page-team")).toBe("core");
    });

    it("passes the parent segment's params to nested pages and keeps the layout", async () => {
      const body = await page(app, "/teams/design/members");
      expectNested(body, ["team-layout", "layout-team", "members-team"]);
      expect(textById(body, "layout-team")).toBe("design");
      expect(textById(body, "members-team")).toBe("design");
    });
  });

  it("prerenders static routes together with their layouts", () => {
    expect(clientOutputExists(FIXTURE, "dashboard/settings.html")).toBe(true);
    expect(clientOutputExists(FIXTURE, "cart.html")).toBe(true);
  });
});
