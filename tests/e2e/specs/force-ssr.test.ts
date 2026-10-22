import { describe, expect, it } from "vitest";

import { clientOutputExists, readClientOutput, useFixture } from "../harness/fixture.js";
import { textById } from "../harness/html.js";
import { expectDynamic, expectStatic, html } from "../harness/render.js";

const FIXTURE = "force-ssr";

describe('rendering = "force-ssr"', () => {
  const app = useFixture(FIXTURE);

  it("skips prerendering a page that would otherwise be static", () => {
    expect(clientOutputExists(FIXTURE, "forced.html")).toBe(false);
    expect(clientOutputExists(FIXTURE, "forced.rsc")).toBe(false);
    expect(clientOutputExists(FIXTURE, "forced.meta")).toBe(false);
  });

  it("renders the page on every request", async () => {
    const first = await app.fetch("/forced");
    expectDynamic(first);
    const firstId = textById(await html(first), "render-id");
    const secondId = textById(await html(await app.fetch("/forced")), "render-id");
    expect(firstId).not.toBe(secondId);
  });

  it("renders the RSC payload on demand", async () => {
    const response = await app.fetch("/forced.rsc");
    expect(response.status).toBe(200);
    expect(response.headers.get("x-nlite-staletime")).toBe("0");
    expect(response.headers.get("content-type")).toMatch(/^text\/x-component/);
  });

  it("ignores generateStaticParams", () => {
    expect(clientOutputExists(FIXTURE, "posts/first.html")).toBe(false);
    expect(clientOutputExists(FIXTURE, "posts/second.html")).toBe(false);
  });

  it("renders params that generateStaticParams listed on demand", async () => {
    const response = await app.fetch("/posts/first");
    expect(response.status).toBe(200);
    expectDynamic(response);
    expect(textById(await response.text(), "slug")).toBe("first");
  });

  it("renders params that generateStaticParams did not list on demand", async () => {
    const response = await app.fetch("/posts/unlisted");
    expect(response.status).toBe(200);
    expect(textById(await response.text(), "slug")).toBe("unlisted");
  });

  it("has no effect when exported from a layout instead of a page", async () => {
    expect(clientOutputExists(FIXTURE, "layout-flag.html")).toBe(true);
    const response = await app.fetch("/layout-flag");
    expectStatic(response);
  });

  it("treats an unknown rendering value like no value (automatic detection)", async () => {
    expect(clientOutputExists(FIXTURE, "invalid-mode.html")).toBe(true);
    const builtId = textById(readClientOutput(FIXTURE, "invalid-mode.html"), "render-id");
    const response = await app.fetch("/invalid-mode");
    expectStatic(response);
    expect(textById(await response.text(), "render-id")).toBe(builtId);
  });

  it("leaves sibling routes without the export static", async () => {
    expect(clientOutputExists(FIXTURE, "auto.html")).toBe(true);
    expectStatic(await app.fetch("/auto"));
  });
});
