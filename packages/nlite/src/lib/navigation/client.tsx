"use client";

import { useSyncExternalStore } from "react";

import type { NliteRouter, RouterNavigateOptions } from "../../types.js";

interface NavigationSnapshot {
  pathname: string;
  search: string;
  searchParams: URLSearchParams;
}

interface NavigationStore {
  listeners: Set<() => void>;
  snapshot: NavigationSnapshot;
}

const NAVIGATION_RUNTIME_KEY = "__NLITE_NAVIGATION_RUNTIME__";
const NAVIGATION_STORE_KEY = "__NLITE_NAVIGATION_STORE__";
let navigationRuntime: NavigationRuntime | undefined;
let navigationStore: NavigationStore | undefined;

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

export function setNavigationSnapshot(url: URL) {
  const store = getNavigationStore();
  store.snapshot = snapshotFromUrl(url);
  emit(store);
}

function useNavigationSnapshot() {
  return useSyncExternalStore(
    subscribe,
    () => getNavigationStore().snapshot,
    () => getNavigationStore().snapshot,
  );
}

function subscribe(listener: () => void) {
  const store = getNavigationStore();
  store.listeners.add(listener);

  return () => {
    store.listeners.delete(listener);
  };
}

function emit(store: NavigationStore) {
  for (const listener of store.listeners) {
    listener();
  }
}

function getNavigationStore() {
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
    listeners: new Set(),
    snapshot: readSnapshot(),
  };

  (globalThis as unknown as Record<string, NavigationStore>)[NAVIGATION_STORE_KEY] =
    navigationStore;

  return navigationStore;
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
