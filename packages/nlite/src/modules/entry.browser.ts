import React, { startTransition } from "react";
import { hydrateRoot, type Root } from "react-dom/client";
import { createFromReadableStream } from "@vitejs/plugin-rsc/browser";

import {
  setNavigationRuntime,
  setNavigationSnapshot,
  type NavigationRuntime,
} from "../lib/navigation/client.js";
import { fetchRouteTree, invalidateRouteCache, prefetchRoute } from "../lib/route-cache.js";
import type { RouterNavigateOptions, RscPayload } from "../types.js";
import { Document } from "../utils/elements/document.js";

let navigationRoot: Root | null = null;
let navigationVersion = 0;

async function bootNavigation() {
  const inlineStream = window.__NLITE_READ_RSC__?.();
  const payload = inlineStream
    ? await createFromReadableStream(inlineStream)
    : await fetchRouteTree(new URL(window.location.href), createRscHref);

  setNavigationSnapshot(new URL(window.location.href));
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

  if (options.updateHistory) {
    updateBrowserHistory(url, options.updateHistory === "replace");
  }

  setNavigationSnapshot(url);

  startTransition(() => {
    navigationRoot?.render(renderDocument(nextRoot as RscPayload));
  });

  if (options.scroll) {
    scrollToTarget(url.hash);
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
  return React.createElement(Document, { metadata: payload.metadata }, payload.root);
}

bootNavigation();
