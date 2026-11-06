import { defineConfig } from "nlite/config";
import { netlify } from "nlite/adapters";

export default defineConfig({
  ppr: true,
  plugins: [netlify()],
});
