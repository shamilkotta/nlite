import path from "path";

import RouteTrie from "../server/routeTrie";
import { printAndExit } from "../utils";
// import { render } from "./render";
import { ssg } from "./ssg";

export const renderPaths = async (
  dir: string,
  routeTree: RouteTrie,
  store: {
    path: string;
    file: string;
  }[]
) => {
  for (const route of store) {
    const routePath = route.path;
    const module = routeTree.match(routePath);
    if (!module || !module.match) {
      printAndExit(`Something went wrong with rendering ${routePath}`);
      return;
    }
    const moduleData = module.match;
    if (moduleData.rendering == "ssr") continue;

    if (moduleData.rendering == "ssg") {
      const resp = await ssg(dir, moduleData);
      if (!resp) continue;
      const { html, rsc } = resp;
      console.log({ html, rsc });

      moduleData.shell = html;
      moduleData.rsc = rsc;
    } else {
      // const { html } = await render(dir, moduleData);
      // moduleData.shell = html;
    }
  }
};

export const generateTags = (css: string[]) => {
  return css.map((val) => {
    const name = path.parse(val).name;
    const pathFirstInd = val.lastIndexOf("/static");
    const link = `/_nlite/${val.slice(pathFirstInd)}`;
    return { name, link };
  });
};
