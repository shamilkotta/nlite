import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";

import { E2E_ROOT, LOGS_DIR } from "./fixture.js";

/** Builds the nlite package once so every fixture runs against the current source. */
export default function setup() {
  rmSync(LOGS_DIR, { recursive: true, force: true });

  if (process.env.NLITE_E2E_SKIP_PACKAGE_BUILD === "1") {
    return;
  }

  const result = spawnSync("pnpm", ["--filter", "nlite", "build"], {
    cwd: path.resolve(E2E_ROOT, "../.."),
    encoding: "utf8",
  });

  if (result.status !== 0) {
    throw new Error(`Building the nlite package failed:\n${result.stdout}\n${result.stderr}`);
  }
}
