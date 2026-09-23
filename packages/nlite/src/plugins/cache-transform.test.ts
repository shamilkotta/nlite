import { describe, expect, it } from "vitest";
import { transformUseCacheDirectives } from "./index.js";

describe("transformUseCacheDirectives", () => {
  it("wraps use cache functions with stable IDs", async () => {
    const source = `
      export async function getUser(id) {
        "use cache";
        return { id };
      }
    `;

    const first = await transform(source);
    const second = await transform(source);

    expect(first?.code).toBe(second?.code);
    expect(first?.code).toContain('from "virtual:nlite/cache-runtime"');
    expect(first?.code).toMatch(
      /createCachedFunction\("[a-f0-9]{24}", \$\$hoist_0_getUser\$\$impl\)/,
    );
    expect(first?.code).toContain("export const getUser = $$hoist_0_getUser;");
  });

  it("ignores strings outside function directive prologues", async () => {
    const source = `
      const text = "use cache";
      export async function getUser(id) {
        console.log("before directive");
        "use cache";
        return { id };
      }
    `;

    await expect(transform(source)).resolves.toBeUndefined();
  });

  it("wraps cached components", async () => {
    const source = `
      export default async function Page() {
        "use cache";
        return <h1>Hello</h1>;
      }
    `;

    const transformed = await transform(source, "/app/app/page.tsx");

    expect(transformed?.code).toContain("const Page = $$hoist_0_Page;");
    expect(transformed?.code).toContain("export default Page;");
    expect(transformed?.code).toContain("<h1>Hello</h1>");
  });
});

function transform(source: string, id = "/app/src/data.ts") {
  return transformUseCacheDirectives(source, id, "/app");
}
