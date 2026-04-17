import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["**/*.{test,spec}.{ts,tsx,js,jsx}"],
    exclude: ["**/node_modules/**", "**/dist/**", "**/coverage/**"],
    environment: "node",
    passWithNoTests: true,
  },
});
