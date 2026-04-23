import type { ComponentType, ReactNode } from "react";

import type { ErrorBoundaryFallbackComponent } from "./lib/ErrorBoundary.js";

export type RenderingMode = "ssr" | "ssg";

export interface RouteParams {
  [key: string]: string | string[];
}

export interface NlitePageModule {
  default: ComponentType<{ params: RouteParams }>;
  rendering?: RenderingMode;
  generateStaticParams?: () => RouteParams[] | Promise<RouteParams[]>;
}

interface NliteModuleComponent {
  default: ComponentType<{ children: ReactNode; params: RouteParams }>;
}

export interface NliteRouteSegmentModule {
  layout?: NliteModuleComponent;
  loading?: {
    default: ComponentType;
  };
  error?: {
    default: ErrorBoundaryFallbackComponent;
  };
}

export interface NliteRouteRecord {
  id: string;
  routePath: string;
  sourceFile: string;
  page: NlitePageModule;
  tree: NliteRouteSegmentModule[];
  rendering: RenderingMode;
  regex: string;
  paramNames: string[];
}

export interface NliteRouteMatch {
  route: NliteRouteRecord;
  params: RouteParams;
}

export interface NliteOptions {
  appDir?: string;
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
      rendering: RenderingMode;
    };
    __NLITE_READ_RSC__?: () => ReadableStream<Uint8Array>;
    __NLITE_PUSH_RSC__?: (chunk: string) => void;
    __NLITE_CLOSE_RSC__?: () => void;
  }
}
