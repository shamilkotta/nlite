import type { RouteParams } from "../../types.js";

export type MetadataTitle =
  | string
  | {
      default?: string;
      template?: string;
      absolute?: string;
    };

export interface MetadataOpenGraph {
  title?: string;
  description?: string;
  url?: string | URL;
  siteName?: string;
  images?: string | URL | Array<string | URL | { url: string | URL }>;
}

export interface MetadataTwitter {
  card?: "summary" | "summary_large_image" | "app" | "player";
  title?: string;
  description?: string;
  images?: string | URL | Array<string | URL | { url: string | URL }>;
}

export interface Metadata {
  title?: MetadataTitle;
  description?: string;
  keywords?: string | string[];
  robots?: string | { index?: boolean; follow?: boolean };
  metadataBase?: string | URL | null;
  alternates?: {
    canonical?: string | URL;
  };
  openGraph?: MetadataOpenGraph;
  twitter?: MetadataTwitter;
  icons?: {
    icon?: string | URL | Array<string | URL>;
    apple?: string | URL | Array<string | URL>;
  };
}

export type ResolvingMetadata = Promise<Metadata>;

export type GenerateMetadata = (
  props: {
    params: Promise<RouteParams>;
    searchParams: Promise<URLSearchParams>;
  },
  parent: ResolvingMetadata,
) => Metadata | Promise<Metadata>;

export interface MetadataModule {
  metadata?: Metadata;
  generateMetadata?: GenerateMetadata;
}
