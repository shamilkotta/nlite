"use client";

import { useSyncExternalStore } from "react";

import type { NliteRouter, RouterNavigateOptions } from "../types.js";

interface NavigationSnapshot {
  pathname: string;
  search: string;
  searchParams: URLSearchParams;
}

const listeners = new Set<() => void>();

let navigationSnapshot = readSnapshot();
let navigationRuntime: NavigationRuntime | undefined;

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
    navigationRuntime?.push(href, options);
  },
  replace(href, options) {
    navigationRuntime?.replace(href, options);
  },
  back() {
    navigationRuntime?.back();
  },
  forward() {
    navigationRuntime?.forward();
  },
  refresh() {
    navigationRuntime?.refresh();
  },
  async prefetch(href) {
    await navigationRuntime?.prefetch(href);
  },
};

export function setNavigationRuntime(runtime: NavigationRuntime) {
  navigationRuntime = runtime;
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
  navigationSnapshot = snapshotFromUrl(url);
  emit();
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
