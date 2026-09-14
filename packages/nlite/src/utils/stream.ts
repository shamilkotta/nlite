/** Keeps the readable open after the source ends until `release()` so pending RSC thenables stay unresolved. */
export function suppressStreamClose(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader();
  let release!: () => void;
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });

  return {
    stream: new ReadableStream<Uint8Array>({
      async pull(controller) {
        const { done, value } = await reader.read();
        if (done) {
          await released;
          controller.close();
          return;
        }
        controller.enqueue(value);
      },
      cancel(reason) {
        release();
        return reader.cancel(reason);
      },
    }),
    release,
  };
}

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
