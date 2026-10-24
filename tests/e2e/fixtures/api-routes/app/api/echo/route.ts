async function echo(request: Request) {
  const url = new URL(request.url);
  return Response.json({
    method: request.method,
    body: request.method === "GET" ? null : await request.text(),
    query: Object.fromEntries(url.searchParams),
    header: request.headers.get("x-e2e-tag"),
  });
}

export const POST = echo;
export const PUT = echo;
export const PATCH = echo;
export const DELETE = echo;

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: { allow: "POST, PUT, PATCH, DELETE, OPTIONS" },
  });
}
