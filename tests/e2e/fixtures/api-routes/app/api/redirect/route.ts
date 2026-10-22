export function GET(request: Request) {
  return Response.redirect(new URL("/api/hello", request.url), 302);
}
