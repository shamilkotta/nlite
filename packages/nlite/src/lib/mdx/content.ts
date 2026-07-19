import type { ComponentType } from "react";

import type { NliteContentEntry } from "../../types.js";

interface ContentManifestEntry {
  id: string;
  slug: string;
  body: string;
  data: unknown;
  load: () => Promise<{ default: ComponentType }>;
}

interface ContentManifest {
  [collection: string]: ContentManifestEntry[];
}

async function resolveEntry<T>(entry: ContentManifestEntry, collection: string) {
  const mod = await entry.load();
  return {
    id: entry.id,
    collection,
    slug: entry.slug,
    body: entry.body,
    data: entry.data,
    Content: mod.default,
  } as NliteContentEntry<T>;
}

async function getManifest(): Promise<ContentManifest> {
  try {
    const content = await import("virtual:nlite/content");
    return content.collections;
  } catch (error) {
    throw new Error(
      `[nlite] Content APIs require the mdx plugin. Add "mdx()" from "nlite/mdx" to your config plugins. Cause: ${String(error)}`,
    );
  }
}

export async function getCollection<TData = unknown>(collection: string) {
  const manifest = await getManifest();
  const entries = manifest[collection] ?? [];

  return await Promise.all(
    entries.map(async (entry) => {
      return await resolveEntry<TData>(entry, collection);
    }),
  );
}

export async function getEntry<TData = unknown>(collection: string, idOrSlug: string) {
  const manifest = await getManifest();
  const entries = manifest[collection] ?? [];
  const entry = entries.find((item) => item.id === idOrSlug || item.slug === idOrSlug);

  if (!entry) {
    return null;
  }

  return await resolveEntry<TData>(entry, collection);
}
