import { defineConfig } from "nlite/config";
import { vercel } from "nlite/adapters";

export default defineConfig({
  ppr: true,
  plugins: [vercel()],
});
