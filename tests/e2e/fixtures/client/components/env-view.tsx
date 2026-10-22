"use client";

export function EnvView() {
  return (
    <>
      <p id="public-env">{import.meta.env.NLITE_PUBLIC_GREETING ?? "missing"}</p>
      <p id="private-env">{String(import.meta.env.E2E_SERVER_SECRET ?? "undefined")}</p>
    </>
  );
}
