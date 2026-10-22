// Not a recognised mode, so the route falls back to automatic detection.
export const rendering = "force-something-else";

export default function Page() {
  return <p id="render-id">{crypto.randomUUID()}</p>;
}
