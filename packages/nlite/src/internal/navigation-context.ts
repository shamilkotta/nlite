import { AsyncLocalStorage } from "node:async_hooks";

const SERVER_NAVIGATION_URL_KEY = "__NLITE_SERVER_NAVIGATION_URL__";

const navigationUrlContext = new AsyncLocalStorage<URL>();

export function runWithNavigationUrl<T>(url: URL, callback: () => T) {
  installNavigationUrlGetter();
  return navigationUrlContext.run(url, callback);
}

function installNavigationUrlGetter() {
  const globalRecord = globalThis as unknown as Record<string, (() => URL | undefined) | undefined>;
  globalRecord[SERVER_NAVIGATION_URL_KEY] = () => navigationUrlContext.getStore();
}
