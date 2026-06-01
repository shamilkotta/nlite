import { fork, type ChildProcess } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type WorkerChildMessageContext = {
  requestId: number;
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
};

export type WorkerOptions<Method extends string> = {
  exposedMethods: readonly Method[];
  onChildMessage?: (message: unknown, context: WorkerChildMessageContext) => boolean | void;
};

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

export type WorkerProxy<Methods extends Record<string, (...args: any[]) => any>> = {
  [Method in keyof Methods]: (
    ...args: Parameters<Methods[Method]>
  ) => Promise<Awaited<ReturnType<Methods[Method]>>>;
} & {
  end(): void;
};

export function createWorker<Methods extends Record<string, (...args: any[]) => any>>(
  workerPath: string,
  options: WorkerOptions<Extract<keyof Methods, string>>,
): WorkerProxy<Methods> {
  return new Worker(workerPath, options) as WorkerProxy<Methods>;
}

export class Worker<Method extends string = string> {
  private activeChildren = new Set<ChildProcess>();
  private nextRequestId = 1;
  private runnerPath: string;

  constructor(
    private workerPath: string,
    private options: WorkerOptions<Method>,
  ) {
    this.runnerPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "child.mjs");
    for (const method of options.exposedMethods) {
      Object.defineProperty(this, method, {
        enumerable: true,
        value: (...args: unknown[]) => this.call(method, args),
      });
    }
  }

  end() {
    for (const child of this.activeChildren) {
      terminateChild(child);
    }
    this.activeChildren.clear();
  }

  private call(method: Method, args: unknown[]) {
    return new Promise<unknown>((resolve, reject) => {
      const request: WorkerRequest = {
        id: this.nextRequestId++,
        method,
        args,
        workerPath: this.workerPath,
      };
      const child = fork(this.runnerPath, [], {
        cwd: process.cwd(),
        env: process.env,
        stdio: ["ignore", "inherit", "inherit", "ipc"],
      });
      let settled = false;

      this.activeChildren.add(child);

      const rejectOnce = (error: Error) => {
        if (settled) return;

        settled = true;
        this.activeChildren.delete(child);
        terminateChild(child);
        reject(error);
      };

      child.once("error", rejectOnce);
      child.once("exit", (code, signal) => {
        this.activeChildren.delete(child);
        if (settled) return;

        rejectOnce(
          new Error(
            `Worker exited before completing ${method} (code ${code}, signal ${signal ?? "none"})`,
          ),
        );
      });
      const settleResolve = (value: unknown) => {
        if (settled) return;

        settled = true;
        this.activeChildren.delete(child);
        terminateChild(child);
        resolve(value);
      };

      child.on("message", (message: unknown) => {
        if (!message || typeof message !== "object" || settled) return;

        const res = this.options.onChildMessage?.(message, {
          requestId: request.id,
          resolve: settleResolve,
          reject: rejectOnce,
        });
        if (res) return;

        const response = message as WorkerResponse;
        if (response.id !== request.id) return;

        if (response.type === "result") {
          settled = true;
          this.activeChildren.delete(child);
          child.disconnect();
          resolve(response.result);
          return;
        }

        if (response.type === "error") {
          const error = new Error(response.error.message);
          error.name = response.error.name ?? "WorkerError";
          error.stack = response.error.stack;
          rejectOnce(error);
        }
      });

      child.send(request, (error) => {
        if (error) {
          rejectOnce(error);
        }
      });
    });
  }
}

function terminateChild(child: ChildProcess) {
  if (!child.killed) {
    child.kill("SIGTERM");
  }
}
