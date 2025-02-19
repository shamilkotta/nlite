interface Route {
  path: string;
  component?: React.FC;
  layout?: React.FC;
  error?: React.FC;
  loading?: React.FC;
  prerender?: boolean;
  incremental?: string;
  middleWare?: unknown[];
  children?: Route[];
}
