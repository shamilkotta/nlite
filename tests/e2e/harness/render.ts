import { expect } from "vitest";

/**
 * How a response was produced by the preview server:
 * - "static": a prerendered file from `.nlite/client` (sirv adds an ETag)
 * - "dynamic": rendered on demand by the server handler (adds `x-nlite-staletime`, no ETag)
 */
export function renderKind(response: Response) {
  if (response.headers.has("etag")) return "static";
  if (response.headers.has("x-nlite-staletime")) return "dynamic";
  return "unknown";
}

export function expectStatic(response: Response) {
  expect(renderKind(response), `expected ${response.url} to be served from build output`).toBe(
    "static",
  );
}

export function expectDynamic(response: Response) {
  expect(renderKind(response), `expected ${response.url} to be rendered on demand`).toBe("dynamic");
}

export async function html(response: Response) {
  expect(response.headers.get("content-type")).toMatch(/^text\/html/);
  return response.text();
}
