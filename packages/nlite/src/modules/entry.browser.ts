import React, {
  startTransition,
  useInsertionEffect,
  useLayoutEffect,
} from "react";
import { hydrateRoot, type Root } from "react-dom/client";
import { createFromReadableStream } from "@vitejs/plugin-rsc/browser";

import {
  setNavigationRuntime,
  NavigationProvider,
  type NavigationRuntime,
} from "../lib/navigation/client.js";
import {
  fetchRouteTree,
  getPrefetchShell,
  hasFreshRoute,
  invalidateRouteCache,
  prefetchRoute,
} from "../lib/route-cache.js";
import type {
  RouteMetadata,
  RouterNavigateOptions,
  RscPayload,
} from "../types.js";
import { toPrefetchPathname } from "../utils/path.js";
import { AppHead } from "../utils/elements/document.js";

let navigationRoot: Root | null = null;
let navigationVersion = 0;
let currentRootLayout: string | undefined;
// Shells may omit metadata; the head keeps the last known metadata until the full payload lands
let currentMetadata: RouteMetadata = {};
let currentPayload: RscPayload | null = null;

interface PendingNavigation {
  url: URL;
  updateHistory: false | "push" | "replace";
  scroll: boolean;
  onlyHashChange?: boolean;
}

async function bootNavigation() {
  const inlineStream = window.__NLITE_READ_RSC__?.();
  const payload = inlineStream
    ? await createFromReadableStream(inlineStream)
    : await fetchRouteTree(new URL(window.location.href), createRscHref);

  currentRootLayout = (payload as RscPayload).rootLayout;
  navigationRoot = hydrateRoot(
    document,
    renderDocument(payload as RscPayload, {
      url: new URL(window.location.href),
      updateHistory: false,
      scroll: false,
    }),
  );
  setNavigationRuntime(createNavigationRuntime());

  window.addEventListener("popstate", () => {
    void renderUrl(new URL(window.location.href), {
      updateHistory: false,
      scroll: false,
    });
  });

  if (import.meta.hot) {
    import.meta.hot.accept();
    import.meta.hot.on("rsc:update", async () => {
      invalidateRouteCache();
      await refresh();
    });
  }
}

function createNavigationRuntime(): NavigationRuntime {
  return {
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

      await prefetchRoute(url, createPrefetchHref);
    },
  };
}

async function refresh() {
  await renderUrl(new URL(window.location.href), {
    updateHistory: false,
    scroll: false,
    bypassCache: true,
  });
}

async function navigate(href: string, options: RouterNavigateOptions) {
  const nextUrl = resolveUrl(href);

  if (!isSameOrigin(nextUrl)) {
    window.location.assign(nextUrl.href);
    return;
  }

  const currentUrl = new URL(window.location.href);

  if (
    currentPayload &&
    nextUrl.pathname === currentUrl.pathname &&
    nextUrl.search === currentUrl.search
  ) {
    // Hash-only change: same payload, new URL. Supersedes any navigation still in flight.
    navigationVersion++;
    navigationRoot?.render(
      renderDocument(currentPayload, {
        url: nextUrl,
        updateHistory: options.replace ? "replace" : "push",
        scroll: options.scroll ?? true,
        onlyHashChange: true,
      }),
    );
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
    bypassCache?: boolean;
  },
) {
  const version = ++navigationVersion;
  const shell =
    !options.bypassCache && !hasFreshRoute(url) ? getPrefetchShell(url) : null;
  const pendingRoot = fetchRouteTree(url, createRscHref, {
    bypassCache: options.bypassCache,
  });

  // Commit the prefetched shell right away, then patch in the full payload once it arrives.
  // Keys match between the two, so layouts stay mounted and only the holes are filled.
  if (shell) {
    if (!commitNavigation(url, shell, options)) {
      return;
    }
  }

  const nextRoot = (await pendingRoot) as RscPayload;

  if (version !== navigationVersion) {
    return;
  }

  if (shell) {
    if (nextPayloadChangesRootLayout(nextRoot)) {
      return hardNavigate(url, false);
    }
    startTransition(() => {
      navigationRoot?.render(
        renderDocument(nextRoot, { url, updateHistory: false, scroll: false }),
      );
    });
    return;
  }

  commitNavigation(url, nextRoot, options);
}

function commitNavigation(
  url: URL,
  payload: RscPayload,
  options: { updateHistory: false | "push" | "replace"; scroll: boolean },
) {
  // Different root layouts own different <html> documents, so they cannot be reconciled
  if (nextPayloadChangesRootLayout(payload)) {
    hardNavigate(url, options.updateHistory);
    return false;
  }

  // The URL is rendered with the tree, and history and scroll are applied once the
  // transition commits (see NavigationCommitter), so the old page is never scrolled or relabelled early.
  startTransition(() => {
    navigationRoot?.render(
      renderDocument(payload, {
        url,
        updateHistory: options.updateHistory,
        scroll: options.scroll,
      }),
    );
  });

  return true;
}

function nextPayloadChangesRootLayout(payload: RscPayload) {
  return payload.rootLayout !== currentRootLayout;
}

function hardNavigate(url: URL, updateHistory: false | "push" | "replace") {
  if (updateHistory === "replace") {
    window.location.replace(url.href);
  } else if (updateHistory === "push") {
    window.location.assign(url.href);
  } else {
    window.location.reload();
  }
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

function createPrefetchHref(url: URL) {
  return `${toPrefetchPathname(url.pathname)}${url.search}`;
}

function createRscHref(url: URL) {
  const pathname = `${url.pathname}.rsc`;
  return `${pathname}${url.search}`;
}

function scrollToTarget(hash: string, onlyHashChange = false) {
  withoutSmoothScroll(() => {
    if (!hash) {
      // scrollIntoView() on <html> scrolls horizontally in some browsers, so only reset vertically.
      document.documentElement.scrollTop = 0;
      return;
    }

    getHashFragmentElement(decodeURIComponent(hash.slice(1)))?.scrollIntoView();
  }, onlyHashChange);
}

// Mirrors browser behavior: `#top` scrolls to the top, otherwise match by id, then by name.
function getHashFragmentElement(fragment: string): HTMLElement | null {
  if (fragment === "top") {
    return document.body;
  }

  return (
    document.getElementById(fragment) ??
    document.getElementsByName(fragment)[0] ??
    null
  );
}

// Route transitions jump instantly even with `<html data-scroll-behavior="smooth">`;
// hash-only changes keep smooth scrolling.
function withoutSmoothScroll(fn: () => void, onlyHashChange: boolean) {
  const html = document.documentElement;

  if (onlyHashChange || html.dataset.scrollBehavior !== "smooth") {
    fn();
    return;
  }

  const existing = html.style.scrollBehavior;
  html.style.scrollBehavior = "auto";
  html.getClientRects(); // force reflow so Chrome picks up the change
  fn();
  html.style.scrollBehavior = existing;
}

function NavigationCommitter({
  navigation,
  children,
}: {
  navigation: PendingNavigation;
  children?: React.ReactNode;
}) {
  useInsertionEffect(() => {
    if (navigation.updateHistory) {
      updateBrowserHistory(
        navigation.url,
        navigation.updateHistory === "replace",
      );
    }
  }, [navigation]);

  useLayoutEffect(() => {
    if (navigation.scroll) {
      scrollToTarget(navigation.url.hash, navigation.onlyHashChange);
    }
  }, [navigation]);

  return React.createElement(
    NavigationProvider,
    { url: navigation.url },
    children,
  );
}

function renderDocument(payload: RscPayload, navigation: PendingNavigation) {
  currentPayload = payload;
  if (payload.metadata) {
    currentMetadata = payload.metadata;
  }

  return React.createElement(
    NavigationCommitter,
    { navigation },
    // The user's root layout renders <html>/<body>; head nodes are hoisted into its <head>
    React.createElement(
      React.Fragment,
      null,
      React.createElement(AppHead, { metadata: currentMetadata }),
      payload.root,
    ),
  );
}

bootNavigation();
