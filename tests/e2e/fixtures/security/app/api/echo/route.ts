export async function GET(request: Request) {
  return Response.json({ q: new URL(request.url).searchParams.get("q") });
}
