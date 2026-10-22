export const rendering = "force-ssr";

export default function Page() {
  return <p id="render-id">{crypto.randomUUID()}</p>;
}
