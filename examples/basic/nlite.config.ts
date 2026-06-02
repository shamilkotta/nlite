import { defineConfig } from "nlite/config";
import path from "node:path";
import { defineCollection, mdx } from "nlite/mdx";
import { z } from "zod";

export default defineConfig({
  plugins: [
    mdx({
      collections: {
        blog: defineCollection({
          source: "app/examples/blog/**/*.{md,mdx}",
          schema: z.object({
            title: z.string(),
            description: z.string(),
            publishedAt: z.coerce.date(),
            tags: z.array(z.string()).default([]),
            draft: z.boolean().default(false),
          }),
        }),
      },
    }),
    // vercel(),
  ],
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
