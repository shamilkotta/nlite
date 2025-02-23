/// <reference types="vite/client" />

export * from "./dist/index";

export interface Route {
  path?: string;
  module?: string;
  layout?: string;
  error?: string;
  loading?: string;
  notFound?: string;
  prerender?: boolean;
  incremental?: string;
  middleWare?: unknown[];
  children?: Route[];
}
