import { pathToFileURL } from "node:url";

type WorkerRequest = {
  id: number;
  method: string;
  args: unknown[];
  workerPath: string;
};

type WorkerResponse =
  | {
      id: number;
      type: "result";
      result: unknown;
    }
  | {
      id: number;
      type: "error";
      error: {
        name?: string;
        message: string;
        stack?: string;
      };
    };

process.once("message", (request: WorkerRequest) => {
  handleRequest(request).catch((error: unknown) => {
    sendMessage({
      id: request.id,
      type: "error",
      error: serializeError(error),
    });
  });
});

async function handleRequest(request: WorkerRequest) {
  const workerModule = await import(/* @vite-ignore */ pathToFileURL(request.workerPath).href);
  const method = workerModule[request.method];

  if (typeof method !== "function") {
    throw new Error(`Worker module does not export ${request.method}()`);
  }

  sendMessage({
    id: request.id,
    type: "result",
    result: await method(...request.args),
  });
}

function sendMessage(message: WorkerResponse) {
  if (process.send) {
    process.send(message, () => {
      process.exit(message.type === "error" ? 1 : 0);
    });
    return;
  }

  process.exit(message.type === "error" ? 1 : 0);
}

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return {
    message: String(error),
  };
}
