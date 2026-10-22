import http from "node:http";
import type net from "node:net";

import { afterAll, beforeAll } from "vitest";

export interface Upstream {
  url: string;
  /** Number of requests the upstream has received for `pathname`. */
  hits(pathname: string): number;
  close(): Promise<void>;
}

/**
 * A local HTTP API for fixtures that call `fetch()`. Every response is JSON
 * `{ path, hit }` where `hit` counts requests to that path, which makes it easy to
 * tell a build-time (cached) response apart from a per-request one.
 */
export async function startUpstream(): Promise<Upstream> {
  const counts = new Map<string, number>();
  const server = http.createServer((req, res) => {
    const pathname = new URL(req.url ?? "/", "http://upstream").pathname;
    const hit = (counts.get(pathname) ?? 0) + 1;
    counts.set(pathname, hit);
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ path: pathname, hit }));
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as net.AddressInfo;

  return {
    url: `http://127.0.0.1:${port}`,
    hits: (pathname) => counts.get(pathname) ?? 0,
    close: () =>
      new Promise((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}

/** Starts an upstream before the file's fixtures build and stops it afterwards. */
export function useUpstream() {
  const state = {} as Upstream;
  let upstream: Upstream | undefined;

  beforeAll(async () => {
    upstream = await startUpstream();
    Object.assign(state, upstream);
  });

  afterAll(async () => {
    await upstream?.close();
  });

  return state;
}
