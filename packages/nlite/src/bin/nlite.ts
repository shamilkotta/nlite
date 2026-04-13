#!/usr/bin/env node

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const args = process.argv.slice(2);
const viteArgs = buildViteArgs(args);
const rootDir = resolveProjectRoot(args);
const configFile = resolveConfigFile(rootDir, viteArgs);
const viteBin = resolveViteBin(rootDir);

const child = spawn(
  process.execPath,
  [viteBin, ...injectConfigArg(viteArgs, configFile)],
  {
    cwd: process.cwd(),
    stdio: "inherit",
    env: process.env
  }
);

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});

function buildViteArgs(inputArgs: string[]) {
  const normalizedArgs = inputArgs.filter((arg) => arg !== "--");
  const [firstArg, ...rest] = normalizedArgs;

  if (!firstArg || firstArg.startsWith("-")) {
    return normalizedArgs;
  }

  if (firstArg === "start") {
    return ["preview", ...rest];
  }

  return normalizedArgs;
}

function resolveProjectRoot(inputArgs: string[]) {
  const [firstArg, secondArg] = inputArgs;

  if (firstArg && !firstArg.startsWith("-")) {
    if (isViteCommand(firstArg)) {
      if (secondArg && !secondArg.startsWith("-")) {
        return path.resolve(process.cwd(), secondArg);
      }

      return process.cwd();
    }

    return path.resolve(process.cwd(), firstArg);
  }

  return process.cwd();
}

function resolveConfigFile(projectRoot: string, viteArgs: string[]) {
  if (hasConfigArg(viteArgs)) {
    return undefined;
  }

  const candidates = [
    "nlite.config.ts",
    "nlite.config.mts",
    "nlite.config.js",
    "nlite.config.mjs",
    "nlite.config.cts",
    "nlite.config.cjs"
  ];

  for (const candidate of candidates) {
    const absolutePath = path.join(projectRoot, candidate);

    if (existsSync(absolutePath)) {
      return absolutePath;
    }
  }

  return undefined;
}

function injectConfigArg(viteArgs: string[], configFile?: string) {
  if (!configFile) {
    return viteArgs;
  }

  return ["--config", configFile, ...viteArgs];
}

function hasConfigArg(viteArgs: string[]) {
  return viteArgs.includes("--config") || viteArgs.includes("-c");
}

function isViteCommand(value: string) {
  return ["dev", "build", "preview", "serve", "start"].includes(value);
}

function resolveViteBin(projectRoot: string) {
  const localRequire = createRequire(path.join(projectRoot, "package.json"));

  try {
    const vitePackageJson = localRequire.resolve("vite/package.json");
    return path.join(path.dirname(vitePackageJson), "bin", "vite.js");
  } catch {
    const vitePackageJson =
      createRequire(import.meta.url).resolve("vite/package.json");
    return path.join(path.dirname(vitePackageJson), "bin", "vite.js");
  }
}
