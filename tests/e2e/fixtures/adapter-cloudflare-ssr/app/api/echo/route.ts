export async function GET(request: Request) {
  const url = new URL(request.url);
  return Response.json({ path: url.pathname, q: url.searchParams.get("q") });
}

export async function POST(request: Request) {
  return Response.json({ body: await request.text() }, { status: 201 });
}
