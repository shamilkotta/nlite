import { defineConfig } from "nlite/config";
import path from "node:path";
import { vercel } from "nlite/adapters";

export default defineConfig({
  plugins: [vercel()],
  staleTimes: {
    static: 600,
  },
  vite: {
    resolve: {
      alias: {
        "@": path.resolve(process.cwd()),
      },
    },
  },
});
