import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    root: import.meta.dirname,
    include: ["specs/**/*.test.ts"],
    environment: "node",
    globalSetup: ["./harness/global-setup.ts"],
    // Every spec builds its own fixture app; cap concurrency so builds don't starve each other.
    maxWorkers: Number(process.env.NLITE_E2E_WORKERS ?? 4),
    testTimeout: 30_000,
    hookTimeout: 180_000,
    sequence: { hooks: "stack" },
  },
});
