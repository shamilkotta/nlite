// `nlite/navigation` as seen by Server Components (resolved through the `react-server`
// export condition). The client hooks module depends on client-only React APIs and must
// never be evaluated in the RSC environment, so only server-safe APIs are re-exported here.
export { notFound } from "./not-found.js";
export { redirect } from "./redirect.js";

function clientOnly(name: string): never {
  throw new Error(
    `${name}() is only available in Client Components. Add "use client" to the file that calls it.`,
  );
}

export function usePathname(): never {
  return clientOnly("usePathname");
}

export function useSearchParams(): never {
  return clientOnly("useSearchParams");
}

export function useRouter(): never {
  return clientOnly("useRouter");
}
