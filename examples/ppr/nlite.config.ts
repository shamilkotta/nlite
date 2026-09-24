import { defineConfig } from "nlite/config";
import { vercel } from "nlite/adapters";
import path from "node:path";

export default defineConfig({
  plugins: [vercel()],
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
