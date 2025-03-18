export * from "./nliteConfig";
// export * from "./_error";

export interface Route {
  path?: string;
  element?: string;
  layout?: string;
  error?: string;
  loading?: string;
  // notFound?: string;
  prerender?: boolean;
  incremental?: string;
  middleWare?: unknown[];
  children?: Route[];
}
