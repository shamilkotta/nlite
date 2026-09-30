import { defineConfig } from "nlite/config";
import { netlify } from "nlite/adapters";
import path from "node:path";

export default defineConfig({
  plugins: [netlify()],
  staleTimes: {
    static: 600,
  },
  ppr: true,
  vite: {
    resolve: {
      alias: {
        "@": path.resolve(process.cwd()),
      },
    },
  },
});
