export type ApiFetchResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string };

/** Same-origin fetch from a Server Component. Requires NLITE_ORIGIN (no trailing slash), e.g. http://127.0.0.1:8787 */
export async function fetchApiJson<T>(path: string): Promise<ApiFetchResult<T>> {
  const origin = process.env.NLITE_ORIGIN?.trim().replace(/\/$/, "");

  if (!origin) {
    return {
      ok: false,
      message:
        "Set NLITE_ORIGIN so fetch() can reach API routes (e.g. http://127.0.0.1:8787 with wrangler dev).",
    };
  }

  const pathname = path.startsWith("/") ? path : `/${path}`;

  try {
    const response = await fetch(`${origin}${pathname}`, { cache: "no-store" });

    if (!response.ok) {
      return { ok: false, message: `HTTP ${response.status}` };
    }

    return { ok: true, data: (await response.json()) as T };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "fetch failed",
    };
  }
}
