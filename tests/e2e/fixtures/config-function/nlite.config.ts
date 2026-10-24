import path from "node:path";
import { defineConfig } from "nlite/config";

export default defineConfig(({ command, mode }) => ({
  staleTimes: { static: command === "build" ? 11 : 99 },
  vite: {
    resolve: { alias: { "@lib": path.resolve(import.meta.dirname, "lib") } },
    define: { __E2E_MODE__: JSON.stringify(mode) },
  },
}));
