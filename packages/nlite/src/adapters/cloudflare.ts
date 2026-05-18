import { fileURLToPath } from "node:url";
import path from "node:path";
import type { PluginOption } from "vite";

export async function cloudflare(): Promise<PluginOption[]> {
  const { cloudflare: cloudflarePlugin } = await import("@cloudflare/vite-plugin");

  const distRoot = path.dirname(fileURLToPath(import.meta.url));
  const rscEntryPath = path.join(distRoot, "modules", "entry.rsc");

  return [
    ...cloudflarePlugin({
      viteEnvironment: {
        name: "rsc",
        childEnvironments: ["ssr", "api"],
      },
      config(wranglerConfig) {
        const defaults: Record<string, unknown> = {
          main: rscEntryPath,
          compatibility_date: wranglerConfig.compatibility_date,
          workers_dev: wranglerConfig.workers_dev ?? true,
          assets: {
            ...wranglerConfig.assets,
            not_found_handling: "none",
            html_handling: "drop-trailing-slash",
          },
        };

        if (!wranglerConfig.compatibility_flags?.includes("nodejs_compat")) {
          defaults.compatibility_flags = ["nodejs_compat"];
        }

        return defaults;
      },
    }),
  ];
}
