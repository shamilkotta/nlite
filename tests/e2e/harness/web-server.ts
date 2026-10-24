import http from "node:http";
import type { AddressInfo } from "node:net";
import { Readable } from "node:stream";

export interface WebServer {
  origin: string;
  close(): Promise<void>;
}

/** Serves a web-standard `(Request) => Response` handler over HTTP on a free local port. */
export async function startWebServer(
  handler: (request: Request) => Promise<Response>,
): Promise<WebServer> {
  const server = http.createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const hasBody = chunks.length > 0 && req.method !== "GET" && req.method !== "HEAD";
    const request = new Request(new URL(req.url!, `http://${req.headers.host}`), {
      method: req.method,
      headers: req.headers as Record<string, string>,
      body: hasBody ? Buffer.concat(chunks) : undefined,
    });

    let response: Response;
    try {
      response = await handler(request);
    } catch (error) {
      response = new Response(`emulator error: ${(error as Error).stack}`, { status: 599 });
    }

    res.writeHead(response.status, Object.fromEntries(response.headers));
    if (!response.body || req.method === "HEAD") return res.end();
    // Like a real platform, send the status line before the body, so a stream that fails
    // later shows up as a truncated response rather than a dropped connection.
    res.flushHeaders();
    Readable.fromWeb(response.body as never)
      .on("error", () => res.end())
      .pipe(res);
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;

  return {
    origin: `http://127.0.0.1:${port}`,
    close: async () => {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    },
  };
}

export const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".rsc": "text/x-component",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".txt": "text/plain; charset=utf-8",
};
