export async function teeRscStream(stream: ReadableStream<Uint8Array> | undefined) {
  if (!stream) {
    throw new Error("Missing RSC stream");
  }

  if (typeof stream.tee === "function") {
    return stream.tee();
  }

  const chunks: Uint8Array[] = [];
  const reader = stream.getReader();

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    chunks.push(value);
  }

  const createReplayStream = () =>
    new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(chunk);
        }

        controller.close();
      },
    });

  return [createReplayStream(), createReplayStream()] as const;
}
