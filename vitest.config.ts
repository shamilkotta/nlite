import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["**/*.{test,spec}.{ts,tsx,js,jsx}"],
    // End-to-end specs build and serve fixture apps; run them with `pnpm test:e2e`.
    exclude: ["**/node_modules/**", "**/dist/**", "**/coverage/**", "tests/e2e/**"],
    environment: "node",
    passWithNoTests: true,
  },
});
