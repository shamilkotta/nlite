/** Per-render timestamp — frozen in SSG output, fresh on each SSR request. */
export function getRenderTimestamp() {
  return new Date().toISOString();
}
