import { defineConfig, UserConfig } from "vite";
import react from "@vitejs/plugin-react";

export const nliteConfig = (config: UserConfig) => {
  return defineConfig({
    ...config,
    plugins: config.plugins ? [...config.plugins, react()] : [react()]
  });
};
