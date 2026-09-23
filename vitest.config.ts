import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "unit",
          include: ["packages/**/*.{test,spec}.{ts,tsx,js,jsx}"],
          exclude: ["**/node_modules/**", "**/dist/**", "**/coverage/**"],
          environment: "node",
        },
      },
      {
        test: {
          name: "e2e",
          include: ["tests/e2e/**/*.test.ts"],
          exclude: ["**/node_modules/**", "**/.nlite/**"],
          environment: "node",
          testTimeout: 60_000,
          hookTimeout: 180_000,
          fileParallelism: false,
          sequence: {
            concurrent: false,
          },
        },
      },
    ],
  },
});
