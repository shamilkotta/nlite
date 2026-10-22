export function GET(request: Request) {
  const status = Number(new URL(request.url).searchParams.get("status") ?? 200);
  const headers = new Headers({ "content-type": "text/plain", "x-custom": "custom-value" });
  headers.append("set-cookie", "session=abc; Path=/; HttpOnly");
  headers.append("set-cookie", "theme=dark; Path=/");
  return new Response(status === 204 ? null : `status ${status}`, { status, headers });
}
