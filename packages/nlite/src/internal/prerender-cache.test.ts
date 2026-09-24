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

  it("keys force-cache fetches", async () => {
    const fetchImpl = vi.fn(async () => new Response("cached"));
    const cache = new PrerenderCache();

    await cache.fetch("http://localhost:8000", { cache: "force-cache" }, fetchImpl);
    const restored = new PrerenderCache(await cache.serialize());
    const resumed = await restored.fetch(
      "http://localhost:8000/",
      { cache: "force-cache", headers: { traceparent: "00-abc" } },
      fetchImpl,
    );

    expect(await resumed.text()).toBe("cached");
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    await restored.fetch(
      new Request("http://localhost:8000/", {
        cache: "force-cache",
        referrer: "https://vercel.example/",
      }),
      undefined,
      fetchImpl,
    );
    expect(fetchImpl).toHaveBeenCalledTimes(2);

    await restored.fetch(
      "http://localhost:8000/",
      { cache: "force-cache", method: "POST", body: "one" },
      fetchImpl,
    );
    await restored.fetch(
      "http://localhost:8000/",
      { cache: "force-cache", method: "POST", body: "two" },
      fetchImpl,
    );
    expect(fetchImpl).toHaveBeenCalledTimes(4);
  });

  it("resolves a stored fetch without re-fetching and tracks a miss before it starts", async () => {
    const fetchImpl = vi.fn(async () => new Response("cached"));
    const cache = new PrerenderCache();
    await cache.fetch("http://localhost:8000", { cache: "force-cache" }, fetchImpl);
    const restored = new PrerenderCache(await cache.serialize());

    const hit = await restored.fetch("http://localhost:8000", { cache: "force-cache" }, fetchImpl);
    expect(await hit.text()).toBe("cached");
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    const signal = new CacheSignal();
    let ready = false;
    const readyPromise = signal.ready().then(() => {
      ready = true;
    });
    let releaseFetch!: () => void;
    const blockedFetch = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          releaseFetch = () => resolve(new Response("fresh"));
        }),
    );
    const pendingMiss = new PrerenderCache().fetch(
      "http://localhost:8000",
      { cache: "force-cache" },
      blockedFetch,
      signal,
    );

    await vi.waitFor(() => expect(blockedFetch).toHaveBeenCalled());
    expect(ready).toBe(false);
    releaseFetch();
    await pendingMiss;
    await readyPromise;
    expect(ready).toBe(true);
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

  it("refuses to persist React elements as JSON", async () => {
    const cache = new PrerenderCache();
    cache.data("cmp:render", [], () => ({
      $$typeof: Symbol.for("react.transitional.element"),
      type: "h1",
      key: null,
      ref: null,
      props: { children: "Hello" },
    }));

    await expect(cache.serialize()).rejects.toThrow(/React element/);
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

  it("keeps the request cache for work scheduled inside the request", async () => {
    const originalFetch = globalThis.fetch;
    const fetchImpl = vi.fn(async () => new Response("from-network"));
    globalThis.fetch = fetchImpl;

    try {
      const rendered = new Promise<string>((resolve, reject) => {
        void runWithRequestContext(new Request("https://example.com"), () => {
          queueMicrotask(async () => {
            try {
              const cached = await fetch("https://example.com/data", { cache: "force-cache" });
              const again = await fetch("https://example.com/data", { cache: "force-cache" });
              resolve((await cached.text()) + (await again.text()));
            } catch (error) {
              reject(error);
            }
          });
        });
      });

      expect(await rendered).toBe("from-networkfrom-network");
      expect(fetchImpl).toHaveBeenCalledTimes(1);

      const outside = await fetch("https://example.com/other");
      expect(await outside.text()).toBe("from-network");
      expect(fetchImpl).toHaveBeenCalledTimes(2);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("reads each in-flight request cache from the request store", async () => {
    const originalFetch = globalThis.fetch;
    const fetchImpl = vi.fn(async () => new Response("from-network"));
    globalThis.fetch = fetchImpl;

    try {
      const cacheA = new PrerenderCache();
      await cacheA.fetch(
        "https://example.com/a",
        { cache: "force-cache" },
        async () => new Response("A"),
      );
      const cacheB = new PrerenderCache();
      await cacheB.fetch(
        "https://example.com/b",
        { cache: "force-cache" },
        async () => new Response("B"),
      );

      const renderFor = (url: string, cache: PrerenderCache) =>
        new Promise<string>((resolve, reject) => {
          void runWithRequestContext(
            new Request("https://example.com"),
            () => {
              queueMicrotask(async () => {
                try {
                  const response = await fetch(url, { cache: "force-cache" });
                  resolve(await response.text());
                } catch (error) {
                  reject(error);
                }
              });
            },
            { cache },
          );
        });

      const [textA, textB] = await Promise.all([
        renderFor("https://example.com/a", cacheA),
        renderFor("https://example.com/b", cacheB),
      ]);

      expect(textA).toBe("A");
      expect(textB).toBe("B");
      expect(fetchImpl).not.toHaveBeenCalled();
    } finally {
      globalThis.fetch = originalFetch;
    }
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
