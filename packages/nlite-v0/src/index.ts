export * from "./nliteConfig";
export * from "./lib";

export interface Route {
  path?: string;
  element?: string;
  layout?: string;
  error?: string;
  loading?: string;
  rendering?: "default" | "ssr" | "ssg";
  incremental?: string;
  middleWare?: string;
  children?: Route[];
}
