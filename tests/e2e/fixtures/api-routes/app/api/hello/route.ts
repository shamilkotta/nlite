export function GET() {
  return Response.json({ message: "hello" });
}

export function HEAD() {
  return new Response(null, { status: 200, headers: { "x-head": "yes" } });
}
