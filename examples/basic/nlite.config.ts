import { defineConfig } from "nlite/config";
import path from "node:path";
import { vercel } from "nlite/adapters";

export default defineConfig({
  plugins: [vercel()],
  nlite: {
    staleTimes: {
      static: 600,
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(process.cwd()),
    },
  },
});
