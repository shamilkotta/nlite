declare module "virtual:nlite/routes" {
  const routes: import("./types.js").NliteRouteRecord[];

  export { routes };
  export default routes;
}

declare module "@vitejs/plugin-rsc/vendor/react-server-dom/static.edge" {
  export function prerender<TModel>(
    model: TModel,
    clientManifest: ReturnType<typeof import("@vitejs/plugin-rsc/core/rsc").createClientManifest>,
  ): Promise<{
    prelude: ReadableStream;
  }>;
}
