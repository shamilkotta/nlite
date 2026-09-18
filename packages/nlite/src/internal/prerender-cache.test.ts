import { describe, expect, it, vi } from "vitest";
import { CacheSignal, PrerenderCache } from "./prerender-cache.js";
import { runWithRequestContext } from "./request-context.js";

describe("PrerenderCache", () => {
  it("shares cacheable responses across renders and serialization", async () => {
    const fetchImpl = vi.fn(async () => Response.json({ value: 42 }, { status: 201 }));
    const cache = new PrerenderCache();

    const first = await cache.fetch(
      "https://example.com/data",
      { cache: "force-cache" },
      fetchImpl,
    );
    const second = await cache.fetch(
      "https://example.com/data",
      { cache: "force-cache" },
      fetchImpl,
    );

    expect(await first.json()).toEqual({ value: 42 });
    expect(await second.json()).toEqual({ value: 42 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    const restored = new PrerenderCache(await cache.serialize());
    const resumed = await restored.fetch(
      "https://example.com/data",
      { cache: "force-cache" },
      fetchImpl,
    );

    expect(await resumed.json()).toEqual({ value: 42 });
    expect(resumed.status).toBe(201);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("shares data calls by function ID and structurally equivalent arguments", async () => {
    const generate = vi.fn(async () => ({ name: "Ada" }));
    const cache = new PrerenderCache();

    const first = cache.data("users:get", [{ page: 1, role: "admin" }], generate);
    const second = cache.data("users:get", [{ role: "admin", page: 1 }], generate);

    expect(await first).toEqual({ name: "Ada" });
    expect(await second).toEqual({ name: "Ada" });
    expect(generate).toHaveBeenCalledTimes(1);

    const restored = new PrerenderCache(await cache.serialize());
    expect(await restored.data("users:get", [{ page: 1, role: "admin" }], generate)).toEqual({
      name: "Ada",
    });
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it("preserves synchronous return values before and after serialization", async () => {
    const generate = vi.fn(() => ({ enabled: true }));
    const cache = new PrerenderCache();

    const value = cache.data("flags:get", [], generate);
    expect(value).not.toBeInstanceOf(Promise);
    expect(value).toEqual({ enabled: true });
    expect(cache.data("flags:get", [], generate)).toBe(value);

    const restored = new PrerenderCache(await cache.serialize());
    const restoredValue = restored.data("flags:get", [], generate);
    expect(restoredValue).not.toBeInstanceOf(Promise);
    expect(restoredValue).toEqual({ enabled: true });
    expect(generate).toHaveBeenCalledTimes(1);
  });
});

describe("request cache context", () => {
  it("automatically intercepts cacheable fetches", async () => {
    const originalFetch = globalThis.fetch;
    const fetchImpl = vi.fn(async () => new Response("cached"));
    globalThis.fetch = fetchImpl;

    try {
      await runWithRequestContext(new Request("https://example.com"), async () => {
        const first = await fetch("https://example.com/data", { cache: "force-cache" });
        const second = await fetch("https://example.com/data", { cache: "force-cache" });

        expect(await first.text()).toBe("cached");
        expect(await second.text()).toBe("cached");
      });
    } finally {
      globalThis.fetch = originalFetch;
    }

    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe("CacheSignal", () => {
  it("waits for cache reads discovered by a React retry", async () => {
    let resolveFirst!: () => void;
    let resolveSecond!: () => void;
    const first = new Promise<void>((resolve) => {
      resolveFirst = resolve;
    });
    const second = new Promise<void>((resolve) => {
      resolveSecond = resolve;
    });
    const signal = new CacheSignal();
    let ready = false;

    signal.track(first);
    void signal.ready().then(() => {
      ready = true;
    });

    resolveFirst();
    queueMicrotask(() => signal.track(second));
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(ready).toBe(false);

    resolveSecond();
    await signal.ready();
    expect(ready).toBe(true);
  });
});
