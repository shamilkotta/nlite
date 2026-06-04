export const NOT_FOUND_ERROR_CODE = "NLITE_NOT_FOUND";
export const REDIRECT_ERROR_CODE = "NLITE_REDIRECT";

export type RedirectType = "push" | "replace";

export type NotFoundError = Error & {
  digest: `${typeof NOT_FOUND_ERROR_CODE};404`;
};

export type RedirectError = Error & {
  digest: `${typeof REDIRECT_ERROR_CODE};${RedirectType};${string};${number};`;
};

export function createNotFoundError(): NotFoundError {
  const digest = `${NOT_FOUND_ERROR_CODE};404` as const;
  const error = new Error(digest) as NotFoundError;
  error.digest = digest;
  return error;
}

export function createRedirectError(
  url: string,
  type: RedirectType,
  statusCode: number,
): RedirectError {
  const digest = `${REDIRECT_ERROR_CODE};${type};${url};${statusCode};` as RedirectError["digest"];
  const error = new Error(REDIRECT_ERROR_CODE) as RedirectError;
  error.digest = digest;
  return error;
}

export function isNotFoundError(error: unknown): error is NotFoundError {
  if (typeof error !== "object" || error === null || !("digest" in error)) {
    return false;
  }

  const digest = error.digest;
  return typeof digest === "string" && digest === `${NOT_FOUND_ERROR_CODE};404`;
}

export function isRedirectError(error: unknown): error is RedirectError {
  if (typeof error !== "object" || error === null || !("digest" in error)) {
    return false;
  }

  const digest = error.digest;
  if (typeof digest !== "string") {
    return false;
  }

  const parts = digest.split(";");
  const [errorCode, type, status] = [parts[0], parts[1], parts.at(-2)];
  const destination = parts.slice(2, -2).join(";");

  return (
    errorCode === REDIRECT_ERROR_CODE &&
    (type === "replace" || type === "push") &&
    typeof destination === "string" &&
    destination.length > 0 &&
    typeof status === "string" &&
    !Number.isNaN(Number(status))
  );
}

export function isNliteRouterError(error: unknown): error is NotFoundError | RedirectError {
  return isNotFoundError(error) || isRedirectError(error);
}

export function getURLFromRedirectError(error: RedirectError): string {
  return error.digest.split(";").slice(2, -2).join(";");
}

export function getRedirectTypeFromError(error: RedirectError): RedirectType {
  return error.digest.split(";")[1] as RedirectType;
}

export function getRedirectStatusCodeFromError(error: RedirectError): number {
  return Number(error.digest.split(";").at(-2));
}
