import type { ComponentType, ReactNode } from "react";

import type { ErrorBoundaryFallbackComponent } from "./lib/error-boundary.js";
import type { MetadataModule } from "./utils/metadata/index.js";

export type RenderingMode = "force-ssg" | "force-ssr";

export interface RouteParams {
  [key: string]: string | string[];
}

export interface PrerenderPath {
  path: string;
  forcePrerender: boolean;
}

export interface RouteMetadataLink {
  rel: string;
  href: string;
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

export interface RouteMetadataIcon {
  url: string;
  sizes?: string;
  type?: string;
  media?: string;
  color?: string;
  rel?: string;
  fetchPriority?: "high" | "low" | "auto";
}

export interface RouteMetadata {
  title?: string;
  description?: string;
  applicationName?: string;
  authors?: Array<{ name?: string; url?: string }>;
  generator?: string;
  keywords?: string;
  referrer?: string;
  creator?: string;
  publisher?: string;
  robots?: string;
  googleBot?: string;
  abstract?: string;
  category?: string;
  classification?: string;
  canonical?: string;
  languages?: Array<{ hrefLang: string; href: string }>;
  mediaAlternates?: Array<{ media: string; href: string }>;
  typeAlternates?: Array<{ type: string; href: string }>;
  openGraph?: {
    title?: string;
    description?: string;
    url?: string;
    siteName?: string;
    locale?: string;
    type?: string;
    images?: Array<{ url: string; alt?: string; width?: number; height?: number; type?: string }>;
  };
  twitter?: {
    card?: "summary" | "summary_large_image" | "app" | "player";
    title?: string;
    description?: string;
    site?: string;
    creator?: string;
    images?: Array<{ url: string; alt?: string }>;
  };
  facebook?: {
    appId?: string;
    admins?: string[];
  };
  pinterest?: {
    richPin?: boolean;
  };
  icons?: {
    icon?: RouteMetadataIcon[];
    shortcut?: RouteMetadataIcon[];
    apple?: RouteMetadataIcon[];
    other?: RouteMetadataIcon[];
  };
  manifest?: string;
  verification?: Array<{ name: string; content: string }>;
  appleWebApp?: {
    capable?: boolean;
    title?: string;
    statusBarStyle?: string;
    startupImage?: Array<{ url: string; media?: string }>;
  };
  formatDetection?: string;
  itunes?: string;
  archives?: string[];
  assets?: string[];
  bookmarks?: string[];
  pagination?: {
    previous?: string;
    next?: string;
  };
  links?: RouteMetadataLink[];
  other?: Array<{ name: string; content: string }>;
}

export interface RscPayload {
  root: React.ReactNode;
  metadata: RouteMetadata;
}

export interface NlitePageModule extends MetadataModule {
  default: ComponentType<{
    params: Promise<RouteParams>;
    searchParams: Promise<URLSearchParams>;
  }>;
  rendering?: RenderingMode;
  generateStaticParams?: () => RouteParams[] | Promise<RouteParams[]>;
}

interface NliteModuleComponent extends MetadataModule {
  default: ComponentType<{
    children: ReactNode;
    params: Promise<RouteParams>;
    searchParams: Promise<URLSearchParams>;
  }>;
}

export interface NliteRouteSegmentModule {
  layout?: NliteModuleComponent;
  loading?: {
    default: ComponentType;
  };
  error?: {
    default: ErrorBoundaryFallbackComponent;
  };
  notFound?: {
    default: ComponentType;
  };
}

export interface NliteRouteRecord {
  id: string;
  routePath: string;
  sourceFile: string;
  page: NlitePageModule;
  tree: NliteRouteSegmentModule[];
  rendering?: RenderingMode;
  regex: string;
  paramNames: string[];
}

export interface NliteRouteMatch {
  route: NliteRouteRecord;
  params: RouteParams;
}

export interface StaleTimes {
  static?: number;
  dynamic?: number;
}

export interface CollectionSchemaSuccess<TOutput> {
  success: true;
  data?: TOutput;
  output?: TOutput;
}

export interface CollectionSchemaFailure {
  success: false;
  error: unknown;
}

export interface CollectionSchemaLike<TOutput = unknown> {
  parse?: (input: unknown) => TOutput;
  safeParse?: (input: unknown) => CollectionSchemaSuccess<TOutput> | CollectionSchemaFailure;
}

export interface CollectionDefinition<TOutput = unknown> {
  source?: string | string[] | CollectionSourceConfig;
  schema?: CollectionSchemaLike<TOutput>;
}

export type CollectionRecord = Record<string, CollectionDefinition<unknown>>;

export interface CollectionSourceConfig {
  cwd: string;
  include?: string | string[];
  exclude?: string | string[];
}

export interface NliteOptions {
  appDir?: string;
  staleTimes?: StaleTimes;
}

export interface NliteContentEntry<TData = unknown> {
  id: string;
  collection: string;
  slug: string;
  body: string;
  data: TData;
  Content: ComponentType;
}

export type ApiRouteHandler = (
  request: Request,
  context: ApiRouteContext,
) => Response | Promise<Response>;

export interface ApiRouteContext {
  params: Promise<RouteParams>;
}

export type ApiRouteModule = Partial<Record<HttpMethod, ApiRouteHandler>>;

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";

export interface ApiRouteRecord {
  id: string;
  routePath: string;
  sourceFile: string;
  module: ApiRouteModule;
  regex: string;
  paramNames: string[];
  catchAllParamNames: string[];
  h3RoutePath: string;
}

export interface NavigateOptions {
  scroll?: boolean;
}

export interface RouterNavigateOptions extends NavigateOptions {
  replace?: boolean;
}

export interface NliteRouter {
  push(href: string, options?: NavigateOptions): void;
  replace(href: string, options?: NavigateOptions): void;
  back(): void;
  forward(): void;
  refresh(): void;
  prefetch(href: string): Promise<void>;
}

declare global {
  interface Window {
    __NLITE_DATA__?: {
      pathname: string;
    };
    __NLITE_READ_RSC__?: () => ReadableStream<Uint8Array>;
    __NLITE_PUSH_RSC__?: (chunk: string) => void;
    __NLITE_CLOSE_RSC__?: () => void;
  }
}
export interface NliteStaticAssets {
  fetch(request: Request): Promise<Response>;
}

export interface NliteHandlerEnv {
  ASSETS?: NliteStaticAssets;
}
