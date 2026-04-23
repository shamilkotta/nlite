"use client";

import { startTransition, useSyncExternalStore } from "react";

import { createFromFetch, createFromReadableStream } from "@vitejs/plugin-rsc/browser";
import { hydrateRoot, type Root } from "react-dom/client";

import type { NliteRouter, RouterNavigateOptions } from "./types.js";

interface NavigationSnapshot {
  pathname: string;
  search: string;
  searchParams: URLSearchParams;
}

const listeners = new Set<() => void>();
const inflightPrefetches = new Map<string, Promise<unknown>>();

let navigationRoot: Root | null = null;
let navigationSnapshot = readSnapshot();
let navigationVersion = 0;

const router: NliteRouter = {
  push(href, options) {
    void navigate(href, { ...options, replace: false });
  },
  replace(href, options) {
    void navigate(href, { ...options, replace: true });
  },
  back() {
    window.history.back();
  },
  forward() {
    window.history.forward();
  },
  refresh() {
    void refresh();
  },
  async prefetch(href) {
    const url = resolveUrl(href);

    if (!isSameOrigin(url)) {
      return;
    }

    await prefetchUrl(url);
  },
};

export async function bootNavigation() {
  const inlineStream = window.__NLITE_READ_RSC__?.();
  const root = inlineStream
    ? await createFromReadableStream(inlineStream)
    : await fetchRouteTree(new URL(window.location.href));

  navigationSnapshot = readSnapshot();
  navigationRoot = hydrateRoot(document, root);

  window.addEventListener("popstate", () => {
    void renderUrl(new URL(window.location.href), {
      updateHistory: false,
      scroll: false,
    });
  });

  if (import.meta.hot) {
    import.meta.hot.accept();
    import.meta.hot.on("rsc:update", async () => {
      await refresh();
    });
  }
}

export function useRouter() {
  return router;
}

export function usePathname() {
  return useNavigationSnapshot().pathname;
}

export function useSearchParams() {
  return useNavigationSnapshot().searchParams;
}

async function refresh() {
  await renderUrl(new URL(window.location.href), {
    updateHistory: false,
    scroll: false,
  });
}

async function navigate(href: string, options: RouterNavigateOptions) {
  const nextUrl = resolveUrl(href);

  if (!isSameOrigin(nextUrl)) {
    window.location.assign(nextUrl.href);
    return;
  }

  const currentUrl = new URL(window.location.href);

  if (nextUrl.pathname === currentUrl.pathname && nextUrl.search === currentUrl.search) {
    updateBrowserHistory(nextUrl, options.replace);

    if (options.scroll !== false) {
      scrollToTarget(nextUrl.hash);
    }

    return;
  }

  await renderUrl(nextUrl, {
    updateHistory: options.replace ? "replace" : "push",
    scroll: options.scroll ?? true,
  });
}

async function renderUrl(
  url: URL,
  options: {
    updateHistory: false | "push" | "replace";
    scroll: boolean;
  },
) {
  const version = ++navigationVersion;
  const nextRoot = await fetchRouteTree(url);

  if (version !== navigationVersion) {
    return;
  }

  if (options.updateHistory) {
    updateBrowserHistory(url, options.updateHistory === "replace");
  }

  navigationSnapshot = snapshotFromUrl(url);
  emit();

  startTransition(() => {
    navigationRoot?.render(nextRoot);
  });

  if (options.scroll) {
    scrollToTarget(url.hash);
  }
}

function useNavigationSnapshot() {
  return useSyncExternalStore(
    subscribe,
    () => navigationSnapshot,
    () => navigationSnapshot,
  );
}

function subscribe(listener: () => void) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

function emit() {
  for (const listener of listeners) {
    listener();
  }
}

function readSnapshot() {
  if (typeof window === "undefined") {
    return {
      pathname: "/",
      search: "",
      searchParams: new URLSearchParams(),
    };
  }

  return snapshotFromUrl(new URL(window.location.href));
}

function snapshotFromUrl(url: URL): NavigationSnapshot {
  return {
    pathname: url.pathname,
    search: url.search,
    searchParams: new URLSearchParams(url.search),
  };
}

function resolveUrl(href: string) {
  return new URL(href, window.location.href);
}

function isSameOrigin(url: URL) {
  return url.origin === window.location.origin;
}

function updateBrowserHistory(url: URL, replace = false) {
  const method = replace ? "replaceState" : "pushState";
  window.history[method](null, "", url);
}

function createRscHref(url: URL) {
  const pathname = `${url.pathname}.rsc`;
  return `${pathname}${url.search}`;
}

function fetchRouteTree(url: URL) {
  return createFromFetch(fetch(createRscHref(url)));
}

function prefetchUrl(url: URL) {
  const key = `${url.pathname}${url.search}`;
  const existing = inflightPrefetches.get(key);

  if (existing) {
    return existing;
  }

  const pending = fetch(createRscHref(url)).then(() => undefined);
  inflightPrefetches.set(key, pending);

  pending.finally(() => {
    inflightPrefetches.delete(key);
  });

  return pending;
}

function scrollToTarget(hash: string) {
  if (!hash) {
    window.scrollTo({ top: 0, left: 0 });
    return;
  }

  const element = document.getElementById(decodeURIComponent(hash.slice(1)));
  element?.scrollIntoView();
}
