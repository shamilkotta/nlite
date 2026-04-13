import { Route } from "../server/routeTrie";

export const render = async (_: string, module: Route) => {
  console.log({ module });
};
