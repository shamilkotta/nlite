import { createServer } from "node:net";
import { spawn, type ChildProcess } from "node:child_process";
import { createWriteStream, existsSync } from "node:fs";
import { mkdir, writeFile, symlink, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const E2E_ROOT = path.resolve(here, "..");

export type E2EApp = {
  baseURL: string;
  port: number;
  fixtureDir: string;
  fetch(pathname: string, init?: RequestInit): Promise<{ response: Response; text: string }>;
  fetchTwice(
    pathname: string,
    init?: RequestInit,
  ): Promise<{
    first: { response: Response; text: string };
    second: { response: Response; text: string };
  }>;
  close(): Promise<void>;
};

export async function createApp(fixtureDir: string): Promise<E2EApp> {
  await ensureFixtureDeps(fixtureDir);
  await buildFixture(fixtureDir);

  const { child, baseURL, port } = await startPreviewServer(fixtureDir);

  return {
    baseURL,
    port,
    fixtureDir,
    async fetch(pathname, init) {
      const response = await fetch(new URL(pathname, baseURL), init);
      const text = await response.text();
      return { response, text };
    },
    async fetchTwice(pathname, init) {
      const first = await this.fetch(pathname, init);
      await delay(50);
      const second = await this.fetch(pathname, init);
      return { first, second };
    },
    async close() {
      await stopChild(child);
    },
  };
}

async function ensureFixtureDeps(fixtureDir: string) {
  const packageJsonPath = path.join(fixtureDir, "package.json");
  if (!existsSync(packageJsonPath)) {
    await writeFile(
      packageJsonPath,
      JSON.stringify(
        {
          name: `e2e-${path.basename(fixtureDir)}`,
          private: true,
          type: "module",
        },
        null,
        2,
      ) + "\n",
    );
  }

  const nodeModules = path.join(fixtureDir, "node_modules");
  if (!existsSync(nodeModules)) {
    await symlink(path.join(E2E_ROOT, "node_modules"), nodeModules, "dir");
  }

  const envDts = path.join(fixtureDir, "nlite-env.d.ts");
  if (!existsSync(envDts)) {
    await writeFile(envDts, '/// <reference types="nlite/client" />\n');
  }

  const configPath = path.join(fixtureDir, "nlite.config.ts");
  if (!existsSync(configPath)) {
    await writeFile(
      configPath,
      `import { defineConfig } from "nlite/config";\n\nexport default defineConfig({});\n`,
    );
  }
}

async function buildFixture(fixtureDir: string) {
  await rm(path.join(fixtureDir, ".nlite"), { recursive: true, force: true });
  await runCommand("pnpm", ["exec", "nlite", "build"], fixtureDir, {
    NODE_ENV: "production",
  });
}

async function startPreviewServer(fixtureDir: string) {
  let lastError: unknown;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const port = await getFreePort();
    try {
      return await launchPreview(fixtureDir, port);
    } catch (error) {
      lastError = error;
      await delay(200);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`Unable to start preview for ${fixtureDir}`);
}

async function launchPreview(fixtureDir: string, port: number) {
  const logDir = path.join(E2E_ROOT, ".logs");
  await mkdir(logDir, { recursive: true });
  const logPath = path.join(logDir, `${path.basename(fixtureDir)}-${port}.log`);
  const logStream = createWriteStream(logPath, { flags: "w" });

  let output = "";
  const child = spawn(
    "pnpm",
    ["exec", "nlite", "preview", "--host", "127.0.0.1", "--port", String(port), "--strictPort"],
    {
      cwd: fixtureDir,
      env: {
        ...process.env,
        NLITE_ORIGIN: `http://127.0.0.1:${port}`,
      },
      stdio: ["ignore", "pipe", "pipe"],
      detached: process.platform !== "win32",
    },
  );

  const onData = (chunk: Buffer) => {
    const text = String(chunk);
    output += text;
    logStream.write(text);
  };
  child.stdout?.on("data", onData);
  child.stderr?.on("data", onData);

  const baseURL = `http://127.0.0.1:${port}`;

  try {
    await waitForServer(baseURL, child);
  } catch (error) {
    await stopChild(child);
    if (/Port .* is already in use|strictPort/i.test(output)) {
      throw new Error(`Port ${port} unavailable`);
    }
    throw error;
  }

  return { child, baseURL, port };
}

async function getFreePort() {
  return await new Promise<number>((resolve, reject) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Unable to allocate a free port"));
        return;
      }
      const { port } = address;
      server.close((error) => {
        if (error) reject(error);
        else resolve(port);
      });
    });
    server.on("error", reject);
  });
}

async function runCommand(command: string, args: string[], cwd: string, env?: NodeJS.ProcessEnv) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, ...env },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stderr = "";
    child.stderr?.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.stdout?.on("data", (chunk) => {
      process.stdout.write(chunk);
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Command failed (${code}): ${command} ${args.join(" ")}\n${stderr}`));
    });
  });
}

async function waitForServer(baseURL: string, child: ChildProcess, timeoutMs = 60_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (child.exitCode !== null) {
      throw new Error(`Preview server exited early with code ${child.exitCode}`);
    }
    try {
      const response = await fetch(baseURL, { redirect: "manual" });
      if (response.status > 0) {
        // Drain body so slow streaming routes don't keep the socket busy.
        await response.arrayBuffer().catch(() => undefined);
        return;
      }
    } catch {
      // retry
    }
    await delay(250);
  }
  throw new Error(`Timed out waiting for preview server at ${baseURL}`);
}

async function stopChild(child: ChildProcess) {
  const pid = child.pid;
  if (!pid) return;

  try {
    process.kill(-pid, "SIGTERM");
  } catch {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      // already gone
    }
  }
}

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export function extractTestId(html: string, testId: string) {
  const pattern = new RegExp(`data-testid="${testId}"[^>]*>([\\s\\S]*?)<\\/`, "i");
  const match = html.match(pattern);
  if (!match?.[1]) return null;

  return match[1]
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}
