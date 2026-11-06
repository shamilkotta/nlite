export function GET() {
  return Response.json({ message: "Hello" });
}

export async function POST(request: Request) {
  return Response.json({ received: await request.json() });
}
