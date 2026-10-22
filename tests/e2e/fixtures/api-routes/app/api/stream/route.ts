export function GET() {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      for (const chunk of ["one,", "two,", "three"]) {
        controller.enqueue(encoder.encode(chunk));
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      controller.close();
    },
  });
  return new Response(stream, { headers: { "content-type": "text/plain" } });
}
