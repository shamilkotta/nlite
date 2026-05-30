declare const __NLITE_STALE_TIMES__: {
  readonly static: number;
  readonly dynamic: number;
};

declare module "virtual:nlite/routes" {
  const routes: import("./types.js").NliteRouteRecord[];

  export { routes };
  export default routes;
}

declare module "virtual:nlite/api" {
  const apiHandler: (request: Request) => Promise<Response>;
  const couldMatchApi: (pathname: string) => boolean;

  export { apiHandler, couldMatchApi };
}

declare module "@vitejs/plugin-rsc/vendor/react-server-dom/static.edge" {
  export function prerender<TModel>(
    model: TModel,
    clientManifest: ReturnType<typeof import("@vitejs/plugin-rsc/core/rsc").createClientManifest>,
    options: {
      signal?: AbortSignal;
      onError(error: unknown, erroStack: object): void;
    },
  ): Promise<{
    prelude: ReadableStream;
  }>;
}
