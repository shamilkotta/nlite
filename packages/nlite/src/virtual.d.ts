declare module "virtual:nlite/routes" {
  const routes: import("./types.js").NliteRouteRecord[];

  export { routes };
  export default routes;
}
