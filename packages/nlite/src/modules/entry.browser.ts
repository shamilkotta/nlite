import React, { startTransition } from "react";
import { hydrateRoot, type Root } from "react-dom/client";
import { createFromReadableStream } from "@vitejs/plugin-rsc/browser";

import {
  setNavigationRuntime,
  setNavigationSnapshot,
  type NavigationRuntime,
} from "../lib/navigation/client.js";
import {
  fetchRouteTree,
  getPrefetchShell,
  hasFreshRoute,
  invalidateRouteCache,
  prefetchRoute,
} from "../lib/route-cache.js";
import type { RouteMetadata, RouterNavigateOptions, RscPayload } from "../types.js";
import { toPrefetchPathname } from "../utils/path.js";
import { AppHead } from "../utils/elements/document.js";

let navigationRoot: Root | null = null;
let navigationVersion = 0;
let currentRootLayout: string | undefined;
// Shells may omit metadata; the head keeps the last known metadata until the full payload lands
let currentMetadata: RouteMetadata = {};

async function bootNavigation() {
  const inlineStream = window.__NLITE_READ_RSC__?.();
  const payload = inlineStream
    ? await createFromReadableStream(inlineStream)
    : await fetchRouteTree(new URL(window.location.href), createRscHref);

  setNavigationSnapshot(new URL(window.location.href));
  currentRootLayout = (payload as RscPayload).rootLayout;
  navigationRoot = hydrateRoot(document, renderDocument(payload as RscPayload));
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

  if (nextUrl.pathname === currentUrl.pathname && nextUrl.search === currentUrl.search) {
    updateBrowserHistory(nextUrl, options.replace);
    setNavigationSnapshot(nextUrl);

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
    bypassCache?: boolean;
  },
) {
  const version = ++navigationVersion;
  const shell = !options.bypassCache && !hasFreshRoute(url) ? getPrefetchShell(url) : null;
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
      navigationRoot?.render(renderDocument(nextRoot));
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

  if (options.updateHistory) {
    updateBrowserHistory(url, options.updateHistory === "replace");
  }

  setNavigationSnapshot(url);

  startTransition(() => {
    navigationRoot?.render(renderDocument(payload));
  });

  if (options.scroll) {
    scrollToTarget(url.hash);
  }

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

function scrollToTarget(hash: string) {
  if (!hash) {
    window.scrollTo({ top: 0, left: 0 });
    return;
  }

  const element = document.getElementById(decodeURIComponent(hash.slice(1)));
  element?.scrollIntoView();
}

function renderDocument(payload: RscPayload) {
  if (payload.metadata) {
    currentMetadata = payload.metadata;
  }

  // The user's root layout renders <html>/<body>; head nodes are hoisted into its <head>
  return React.createElement(
    React.Fragment,
    null,
    React.createElement(AppHead, { metadata: currentMetadata }),
    payload.root,
  );
}

bootNavigation();
