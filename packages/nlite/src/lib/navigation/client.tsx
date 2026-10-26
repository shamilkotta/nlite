"use client";

import { createContext, useContext, useMemo, type Context, type ReactNode } from "react";

import type { NliteRouter, RouterNavigateOptions } from "../../types.js";

interface NavigationSnapshot {
  href: string;
  pathname: string;
  search: string;
  searchParams: URLSearchParams;
  hash: string;
}

interface NavigationStore {
  snapshot: NavigationSnapshot;
}

const NAVIGATION_RUNTIME_KEY = "__NLITE_NAVIGATION_RUNTIME__";
const NAVIGATION_STORE_KEY = "__NLITE_NAVIGATION_STORE__";
const NAVIGATION_CONTEXT_KEY = "__NLITE_NAVIGATION_CONTEXT__";
const SERVER_NAVIGATION_URL_KEY = "__NLITE_SERVER_NAVIGATION_URL__";
let navigationRuntime: NavigationRuntime | undefined;
let navigationStore: NavigationStore | undefined;
const NavigationContext = getNavigationContext();

function getNavigationRuntime() {
  if (navigationRuntime) {
    return navigationRuntime;
  }

  return (globalThis as unknown as Record<string, NavigationRuntime | undefined>)[
    NAVIGATION_RUNTIME_KEY
  ];
}

export interface NavigationRuntime {
  push: (href: string, options?: RouterNavigateOptions) => void;
  replace: (href: string, options?: RouterNavigateOptions) => void;
  back: () => void;
  forward: () => void;
  refresh: () => void;
  prefetch: (href: string) => Promise<void>;
}

const router: NliteRouter = {
  push(href, options) {
    getNavigationRuntime()?.push(href, options);
  },
  replace(href, options) {
    getNavigationRuntime()?.replace(href, options);
  },
  back() {
    getNavigationRuntime()?.back();
  },
  forward() {
    getNavigationRuntime()?.forward();
  },
  refresh() {
    getNavigationRuntime()?.refresh();
  },
  async prefetch(href) {
    await getNavigationRuntime()?.prefetch(href);
  },
};

export function setNavigationRuntime(runtime: NavigationRuntime) {
  navigationRuntime = runtime;
  (globalThis as unknown as Record<string, NavigationRuntime>)[NAVIGATION_RUNTIME_KEY] = runtime;
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

export function NavigationProvider({ url, children }: { url: URL; children?: ReactNode }) {
  // One snapshot per URL so consumers get a stable searchParams object across renders
  const snapshot = useMemo(() => snapshotFromUrl(url), [url.href]);

  return <NavigationContext.Provider value={snapshot}>{children}</NavigationContext.Provider>;
}

// The browser entry provides the URL together with the rendered tree, so both commit in the
// same (transition) render. Outside the provider (ssr / ssg) the store snapshot is used.
function useNavigationSnapshot() {
  return useContext(NavigationContext) ?? getNavigationStore().snapshot;
}

function getNavigationContext() {
  const globals = globalThis as unknown as Record<string, Context<NavigationSnapshot | null>>;
  // Shared through globalThis so duplicated module instances still see one context
  globals[NAVIGATION_CONTEXT_KEY] ??= createContext<NavigationSnapshot | null>(null);
  return globals[NAVIGATION_CONTEXT_KEY];
}

function getNavigationStore() {
  if (typeof window === "undefined") {
    // ssr / ssg
    const url = getServerNavigationUrl();
    navigationStore = {
      snapshot: url
        ? snapshotFromUrl(url)
        : { href: "", pathname: "/", search: "", searchParams: new URLSearchParams(), hash: "" },
    };

    return navigationStore;
  }

  if (navigationStore) {
    return navigationStore;
  }

  const globalStore = (globalThis as unknown as Record<string, NavigationStore | undefined>)[
    NAVIGATION_STORE_KEY
  ];

  if (globalStore) {
    navigationStore = globalStore;
    return globalStore;
  }

  navigationStore = {
    snapshot: snapshotFromUrl(new URL(window.location.href)),
  };

  (globalThis as unknown as Record<string, NavigationStore>)[NAVIGATION_STORE_KEY] =
    navigationStore;

  return navigationStore;
}

function getServerNavigationUrl() {
  return (globalThis as unknown as Record<string, (() => URL | undefined) | undefined>)[
    SERVER_NAVIGATION_URL_KEY
  ]?.();
}

function snapshotFromUrl(url: URL): NavigationSnapshot {
  return {
    href: url.href,
    pathname: url.pathname,
    search: url.search,
    searchParams: new URLSearchParams(url.search),
    hash: url.hash,
  };
}
