// Client hooks. Not a client boundary: Server Components resolve `nlite/navigation` to
// index.react-server.ts, so this module only runs in the ssr and browser environments.
import { createContext, useContext, useMemo, type ReactNode } from "react";

import type { NliteRouter, RouterNavigateOptions } from "../../types.js";

interface NavigationSnapshot {
  pathname: string;
  search: string;
  searchParams: URLSearchParams;
  hash: string;
}

export interface NavigationRuntime {
  push: (href: string, options?: RouterNavigateOptions) => void;
  replace: (href: string, options?: RouterNavigateOptions) => void;
  back: () => void;
  forward: () => void;
  refresh: () => void;
  prefetch: (href: string) => Promise<void>;
}

let navigationRuntime: NavigationRuntime | undefined;

// The URL is provided together with the rendered tree (by entry.ssr and entry.browser),
// so the hooks and the content always come from the same render.
const NavigationContext = createContext<NavigationSnapshot | null>(null);

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
  // Exposed (like `window.next.router`) so tooling and tests can detect a ready router
  (globalThis as unknown as Record<string, NavigationRuntime>).__NLITE_NAVIGATION_RUNTIME__ =
    runtime;
}

export function NavigationProvider({ url, children }: { url: URL; children?: ReactNode }) {
  // One snapshot per URL so consumers get a stable searchParams object across renders
  const snapshot = useMemo(() => snapshotFromUrl(url), [url.href]);

  return <NavigationContext.Provider value={snapshot}>{children}</NavigationContext.Provider>;
}

export function useRouter() {
  return router;
}

export function usePathname() {
  return useNavigationSnapshot("usePathname").pathname;
}

export function useSearchParams() {
  return useNavigationSnapshot("useSearchParams").searchParams;
}

function useNavigationSnapshot(hook: string) {
  const snapshot = useContext(NavigationContext);

  if (!snapshot) {
    throw new Error(`${hook}() must be called from a component rendered by the nlite app.`);
  }

  return snapshot;
}

function snapshotFromUrl(url: URL): NavigationSnapshot {
  return {
    pathname: url.pathname,
    search: url.search,
    searchParams: new URLSearchParams(url.search),
    hash: url.hash,
  };
}
