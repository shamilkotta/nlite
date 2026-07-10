import type { RouteParams } from "../../types.js";

export type MetadataTitle =
  | string
  | {
      default?: string;
      template?: string;
      absolute?: string;
    };

export type MetadataIcon =
  | string
  | URL
  | {
      url: string | URL;
      sizes?: string;
      type?: string;
      media?: string;
      color?: string;
      rel?: string;
      fetchPriority?: "high" | "low" | "auto";
    };

export interface MetadataIcons {
  icon?: MetadataIcon | MetadataIcon[];
  shortcut?: MetadataIcon | MetadataIcon[];
  apple?: MetadataIcon | MetadataIcon[];
  other?: MetadataIcon | MetadataIcon[];
}

export interface MetadataOpenGraph {
  title?: string;
  description?: string;
  url?: string | URL;
  siteName?: string;
  locale?: string;
  type?: string;
  images?:
    | string
    | URL
    | Array<
        | string
        | URL
        | { url: string | URL; alt?: string; width?: number; height?: number; type?: string }
      >;
}

export interface MetadataTwitter {
  card?: "summary" | "summary_large_image" | "app" | "player";
  title?: string;
  description?: string;
  site?: string;
  creator?: string;
  images?: string | URL | Array<string | URL | { url: string | URL; alt?: string }>;
}

export interface MetadataAuthor {
  name?: string;
  url?: string | URL;
}

export interface MetadataRobots {
  index?: boolean;
  follow?: boolean;
  noarchive?: boolean;
  nosnippet?: boolean;
  noimageindex?: boolean;
  nocache?: boolean;
  notranslate?: boolean;
  indexifembedded?: boolean;
  nositelinkssearchbox?: boolean;
  unavailable_after?: string;
  "max-snippet"?: number;
  "max-image-preview"?: "none" | "standard" | "large";
  "max-video-preview"?: number | string;
  googleBot?: string | Omit<MetadataRobots, "googleBot">;
}

export interface MetadataAlternates {
  canonical?: string | URL;
  languages?: Record<string, string | URL | Array<string | URL>>;
  media?: Record<string, string | URL | Array<string | URL>>;
  types?: Record<string, string | URL | Array<string | URL>>;
}

export interface MetadataVerification {
  google?: string | string[];
  yahoo?: string | string[];
  yandex?: string | string[];
  me?: string | string[];
  other?: Record<string, string | number | Array<string | number>>;
}

export interface MetadataAppleWebApp {
  capable?: boolean;
  title?: string;
  startupImage?: string | URL | Array<string | URL | { url: string | URL; media?: string }>;
  statusBarStyle?: "default" | "black" | "black-translucent";
}

export interface MetadataFormatDetection {
  telephone?: boolean;
  date?: boolean;
  address?: boolean;
  email?: boolean;
  url?: boolean;
}

export interface MetadataItunes {
  appId: string;
  appArgument?: string;
}

export interface MetadataFacebook {
  appId?: string;
  admins?: string | string[];
}

export interface MetadataPinterest {
  richPin?: boolean;
}

export interface MetadataPagination {
  previous?: string | URL;
  next?: string | URL;
}

/**
 * Resource hint / arbitrary link tags rendered in <head>.
 * Covers preload, modulepreload, preconnect, dns-prefetch, prefetch, and custom rels.
 */
export interface MetadataLink {
  rel:
    | "preload"
    | "modulepreload"
    | "preconnect"
    | "dns-prefetch"
    | "prefetch"
    | "prerender"
    | "stylesheet"
    | "alternate"
    | "author"
    | "help"
    | "license"
    | "search"
    | "next"
    | "prev"
    | "me"
    | (string & {});
  href: string | URL;
  as?: string;
  type?: string;
  crossOrigin?: "" | "anonymous" | "use-credentials";
  integrity?: string;
  media?: string;
  sizes?: string;
  imageSrcSet?: string;
  imageSizes?: string;
  hrefLang?: string;
  referrerPolicy?: string;
  fetchPriority?: "high" | "low" | "auto";
  title?: string;
}

export interface Metadata {
  title?: MetadataTitle;
  description?: string;
  applicationName?: string;
  authors?: MetadataAuthor | MetadataAuthor[];
  generator?: string;
  keywords?: string | string[];
  referrer?:
    | "no-referrer"
    | "origin"
    | "no-referrer-when-downgrade"
    | "origin-when-cross-origin"
    | "same-origin"
    | "strict-origin"
    | "strict-origin-when-cross-origin"
    | "unsafe-url";
  creator?: string;
  publisher?: string;
  robots?: string | MetadataRobots;
  abstract?: string;
  category?: string;
  classification?: string;
  metadataBase?: string | URL | null;
  alternates?: MetadataAlternates;
  openGraph?: MetadataOpenGraph;
  twitter?: MetadataTwitter;
  facebook?: MetadataFacebook;
  pinterest?: MetadataPinterest;
  icons?: MetadataIcon | MetadataIcon[] | MetadataIcons;
  manifest?: string | URL;
  verification?: MetadataVerification;
  appleWebApp?: boolean | MetadataAppleWebApp;
  formatDetection?: MetadataFormatDetection;
  itunes?: MetadataItunes;
  archives?: string | string[];
  assets?: string | string[];
  bookmarks?: string | string[];
  pagination?: MetadataPagination;
  /**
   * Resource hints and other <link> tags.
   * @example
   * links: [
   *   { rel: "preload", href: "/hero.woff2", as: "font", type: "font/woff2", crossOrigin: "anonymous" },
   *   { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
   *   { rel: "dns-prefetch", href: "https://cdn.example.com" },
   * ]
   */
  links?: MetadataLink | MetadataLink[];
  other?: Record<string, string | number | Array<string | number>>;
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
