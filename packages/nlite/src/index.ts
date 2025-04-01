export * from "./nliteConfig";
export * from "./lib";

export interface Route {
  path?: string;
  element?: string;
  layout?: string;
  error?: string;
  loading?: string;
  prerender?: boolean;
  incremental?: string;
  middleWare?: string;
  children?: Route[];
}
