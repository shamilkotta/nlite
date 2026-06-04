import {
  createRedirectError,
  getRedirectStatusCodeFromError,
  getRedirectTypeFromError,
  getURLFromRedirectError,
  isRedirectError,
  type RedirectError,
  type RedirectType,
} from "./errors.js";

export const RedirectStatusCode = {
  TemporaryRedirect: 307,
  PermanentRedirect: 308,
} as const;

export {
  getRedirectStatusCodeFromError,
  getRedirectTypeFromError,
  getURLFromRedirectError,
  isRedirectError,
};
export type { RedirectError, RedirectType };

export function redirect(url: string, type: RedirectType = "replace"): never {
  throw createRedirectError(url, type, RedirectStatusCode.TemporaryRedirect);
}

export function permanentRedirect(url: string, type: RedirectType = "replace"): never {
  throw createRedirectError(url, type, RedirectStatusCode.PermanentRedirect);
}
