import { defineConfig } from "nlite/config";
import path from "node:path";

export default defineConfig({
  plugins: [
    // vercel(),
  ],
  staleTimes: {
    static: 600,
  },
  enablePartialRender: true,
  vite: {
    resolve: {
      alias: {
        "@": path.resolve(process.cwd()),
      },
    },
  },
});
