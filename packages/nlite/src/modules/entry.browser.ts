import React, { startTransition, useInsertionEffect, useLayoutEffect } from "react";
import { hydrateRoot, type Root } from "react-dom/client";
import { createFromReadableStream } from "@vitejs/plugin-rsc/browser";

import {
  setNavigationRuntime,
  NavigationProvider,
  type NavigationRuntime,
} from "../lib/navigation/client.js";
import { fetchRouteTree, invalidateRouteCache, prefetchRoute } from "../lib/route-cache.js";
import type { RouterNavigateOptions, RscPayload } from "../types.js";
import { AppHead } from "../utils/elements/document.js";

let navigationRoot: Root | null = null;
let navigationVersion = 0;
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

      await prefetchRoute(url, createRscHref);
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
  const nextRoot = await fetchRouteTree(url, createRscHref, {
    bypassCache: options.bypassCache,
  });

  if (version !== navigationVersion) {
    return;
  }

  const nextPayload = nextRoot as RscPayload;
  // Different root layouts own different <html> documents, so they cannot be reconciled
  if (currentPayload && nextPayload.rootPrefix !== currentPayload.rootPrefix) {
    if (options.updateHistory === "replace") {
      window.location.replace(url.href);
    } else if (options.updateHistory === "push") {
      window.location.assign(url.href);
    } else {
      window.location.reload();
    }
    return;
  }

  // The URL is rendered with the tree, and history and scroll are applied once the
  // transition commits (see NavigationCommitter), so the old page is never scrolled or relabelled early.
  startTransition(() => {
    navigationRoot?.render(
      renderDocument(nextPayload, {
        url,
        updateHistory: options.updateHistory,
        scroll: options.scroll,
      }),
    );
  });
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

  return document.getElementById(fragment) ?? document.getElementsByName(fragment)[0] ?? null;
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
      updateBrowserHistory(navigation.url, navigation.updateHistory === "replace");
    }
  }, [navigation]);

  useLayoutEffect(() => {
    if (navigation.scroll) {
      scrollToTarget(navigation.url.hash, navigation.onlyHashChange);
    }
  }, [navigation]);

  return React.createElement(NavigationProvider, { url: navigation.url }, children);
}

function renderDocument(payload: RscPayload, navigation: PendingNavigation) {
  currentPayload = payload;
  return React.createElement(
    NavigationCommitter,
    { navigation },
    // The user's root layout renders <html>/<body>; head nodes are hoisted into its <head>
    React.createElement(
      React.Fragment,
      null,
      React.createElement(AppHead, { metadata: payload.metadata }),
      payload.root,
    ),
  );
}

bootNavigation();
