import { spawn, type ChildProcess } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, beforeAll } from "vitest";

export const E2E_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const FIXTURES_DIR = path.join(E2E_ROOT, "fixtures");
export const LOGS_DIR = path.join(E2E_ROOT, ".logs");
const NLITE_BIN = path.join(E2E_ROOT, "node_modules", "nlite", "bin", "nlite.js");

export type ServerMode = "preview" | "dev";

export interface FixtureOptions {
  /** Extra environment variables for both `nlite build` and the server. */
  env?: Record<string, string | undefined>;
}

export interface BuildResult {
  code: number | null;
  output: string;
}

export interface RunningServer {
  origin: string;
  url(pathname: string): string;
  fetch(pathname: string, init?: RequestInit): Promise<Response>;
  logs(): string;
  close(): Promise<void>;
}

export function fixtureDir(name: string) {
  return path.join(FIXTURES_DIR, name);
}

/** Runs `nlite build` inside a fixture and resolves with its exit code and combined output. */
export async function buildFixture(name: string, options: FixtureOptions = {}): Promise<BuildResult> {
  const cwd = fixtureDir(name);
  const logFile = logPath(name, "build");
  const child = spawnNlite(["build"], cwd, options.env, logFile);

  let output = "";
  child.stdout?.on("data", (chunk) => (output += chunk));
  child.stderr?.on("data", (chunk) => (output += chunk));

  const code = await new Promise<number | null>((resolve) => child.on("exit", resolve));
  return { code, output: stripAnsi(output) };
}

/** Starts `nlite preview` or `nlite dev` on a free port and waits until it answers HTTP. */
export async function startServer(
  name: string,
  mode: ServerMode,
  options: FixtureOptions = {},
): Promise<RunningServer> {
  const cwd = fixtureDir(name);
  const port = await getFreePort();
  const logFile = logPath(name, mode);
  const child = spawnNlite(
    [mode, "--port", String(port), "--strictPort", "--host", "127.0.0.1"],
    cwd,
    options.env,
    logFile,
  );

  let output = "";
  child.stdout?.on("data", (chunk) => (output += chunk));
  child.stderr?.on("data", (chunk) => (output += chunk));

  const origin = `http://127.0.0.1:${port}`;
  await waitForServer(origin, child, () => output);

  return {
    origin,
    url: (pathname) => new URL(pathname, origin).href,
    fetch: (pathname, init) => fetch(new URL(pathname, origin), { redirect: "manual", ...init }),
    logs: () => stripAnsi(output),
    close: () => killProcessTree(child),
  };
}

/**
 * Builds a fixture once and serves it for every test in the file.
 * The returned object is filled in by `beforeAll`, so only read it inside tests.
 */
export function useFixture(
  name: string,
  mode: ServerMode = "preview",
  options: FixtureOptions | (() => FixtureOptions) = {},
) {
  const state = {} as RunningServer & { build: BuildResult; dir: string };
  let server: RunningServer | undefined;

  beforeAll(async () => {
    const resolved = typeof options === "function" ? options() : options;
    state.dir = fixtureDir(name);

    if (mode === "preview") {
      const build = await buildFixture(name, resolved);
      state.build = build;
      if (build.code !== 0) {
        throw new Error(`nlite build failed for fixture "${name}":\n${build.output}`);
      }
    }

    server = await startServer(name, mode, resolved);
    Object.assign(state, server);
  });

  afterAll(async () => {
    await server?.close();
  });

  return state;
}

/** Reads a file relative to the fixture's `.nlite/client` output directory. */
export function readClientOutput(name: string, file: string) {
  return readFileSync(path.join(fixtureDir(name), ".nlite", "client", file), "utf8");
}

export function clientOutputExists(name: string, file: string) {
  return existsSync(path.join(fixtureDir(name), ".nlite", "client", file));
}

export function readJsonOutput<T = Record<string, unknown>>(name: string, file: string): T {
  return JSON.parse(readClientOutput(name, file)) as T;
}

export function removeBuildOutput(name: string) {
  for (const dir of [".nlite", ".vercel", ".netlify"]) {
    rmSync(path.join(fixtureDir(name), dir), { recursive: true, force: true });
  }
}

function spawnNlite(
  args: string[],
  cwd: string,
  env: Record<string, string | undefined> = {},
  logFile: string,
): ChildProcess {
  const child = spawn(process.execPath, [NLITE_BIN, ...args], {
    cwd,
    // Own process group, so the vite process spawned by the nlite CLI is killed with it.
    detached: true,
    env: { ...process.env, NODE_ENV: undefined, FORCE_COLOR: "0", ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });

  mkdirSync(LOGS_DIR, { recursive: true });
  const log = createWriteStream(logFile);
  child.stdout?.pipe(log);
  child.stderr?.pipe(log);

  return child;
}

async function waitForServer(origin: string, child: ChildProcess, output: () => string) {
  const deadline = Date.now() + 60_000;
  let exited = false;
  child.once("exit", () => (exited = true));

  while (Date.now() < deadline) {
    if (exited) {
      throw new Error(`Server exited before it was ready:\n${stripAnsi(output())}`);
    }

    try {
      await fetch(origin, { redirect: "manual", signal: AbortSignal.timeout(2_000) });
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  }

  await killProcessTree(child);
  throw new Error(`Server at ${origin} did not start within 60s:\n${stripAnsi(output())}`);
}

async function killProcessTree(child: ChildProcess) {
  if (child.exitCode !== null || child.signalCode !== null || !child.pid) {
    return;
  }

  const exited = new Promise<void>((resolve) => child.once("exit", () => resolve()));
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    return;
  }

  const timeout = setTimeout(() => {
    try {
      process.kill(-child.pid!, "SIGKILL");
    } catch {}
  }, 5_000);

  await exited;
  clearTimeout(timeout);
}

function getFreePort() {
  return new Promise<number>((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as net.AddressInfo;
      server.close(() => resolve(port));
    });
  });
}

function logPath(name: string, kind: string) {
  return path.join(LOGS_DIR, `${name.replaceAll("/", "__")}.${kind}.log`);
}

function stripAnsi(value: string) {
  // oxlint-disable-next-line no-control-regex
  return value.replace(/\u001b\[[0-9;]*[A-Za-z]/g, "");
}
