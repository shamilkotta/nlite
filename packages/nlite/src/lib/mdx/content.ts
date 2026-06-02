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

async function resolveEntry(
  entry: ContentManifestEntry,
  collection: string,
): Promise<NliteContentEntry> {
  const mod = await entry.load();
  return {
    id: entry.id,
    collection,
    slug: entry.slug,
    body: entry.body,
    data: entry.data,
    Content: mod.default,
  };
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

export async function getCollection<TData = unknown>(
  collection: string,
): Promise<NliteContentEntry<TData>[]> {
  const manifest = await getManifest();
  const entries = manifest[collection] ?? [];

  return await Promise.all(
    entries.map(async (entry) => {
      const resolved = await resolveEntry(entry, collection);
      return resolved as NliteContentEntry<TData>;
    }),
  );
}

export async function getEntry<TData = unknown>(
  collection: string,
  idOrSlug: string,
): Promise<NliteContentEntry<TData> | null> {
  const manifest = await getManifest();
  const entries = manifest[collection] ?? [];
  const entry = entries.find((item) => item.id === idOrSlug || item.slug === idOrSlug);

  if (!entry) {
    return null;
  }

  return (await resolveEntry(entry, collection)) as NliteContentEntry<TData>;
}
