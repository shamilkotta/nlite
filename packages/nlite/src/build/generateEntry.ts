import { promises } from "fs";
import path from "path";
import { nanoid } from "nanoid";

import { getRelativePath } from "../utils/resolveDir";
import { Route } from "..";

const cachePath = ".nlite/.cache/development";
const generateScripts = (
  args: Route,
  parentModule: string | null,
  dir: string
): string | null => {
  const { element, layout, error, loading, middleWare } = args;

  let imports = "";
  let renderer = "";
  let wrapper = "{ children }";
  let middleware = "export const middleware = []";

  // TODO: add support metadata

  if (element)
    imports += `import Element from "${getRelativePath(dir, cachePath, element)}";\n`;
  if (layout) {
    imports += `import ElemLayout from "${getRelativePath(dir, cachePath, layout)}";\n`;
  }
  if (error) {
    imports += `import Error from "${getRelativePath(dir, cachePath, error)}";\n`;
    imports += `import { ErrorBoundary } from "nlite";\n`;
  }
  if (loading) {
    imports += `import Loading from "${getRelativePath(dir, cachePath, loading)}";\n`;
    imports += `import { Suspense } from "react";\n`;
  }

  if (parentModule) {
    imports += `import { Layout as Parent, middleware as parentMiddleware } from "./${parentModule}";\n`;
  }

  if (middleWare) {
    imports += `import moduleMiddleware from "${getRelativePath(dir, cachePath, middleWare)}";\n`;
  }
  middleware = `export const middleware = [ ${parentModule ? "...parentMiddleware" : ""}, ${middleWare ? "moduleMiddleware" : ""} ];`;

  // render layout
  if (loading) {
    wrapper = `<Suspense fallback={<Loading />}>${wrapper}</Suspense>`;
  }
  if (error) {
    wrapper = `<ErrorBoundary fallback={<Error />}>${wrapper}</ErrorBoundary>`;
  }
  if (layout) {
    wrapper = `<ElemLayout>${wrapper}</ElemLayout>`;
  }

  if (parentModule) {
    wrapper = `<Parent>${wrapper}</Parent>`;
  }

  wrapper = `
    export const Layout = ({ children }) => {
     return (<>${wrapper}</>);
    }
  `;

  if (element) {
    renderer = `
      export default () => {
        return (<Layout><Element /></Layout>);
      }
    `;
  }

  let file = "";

  if (imports.trim().length) {
    imports = imports.replaceAll(".tsx.js", ".tsx");
    imports = imports.replaceAll(".ts.js", ".ts");
    file += imports;
    if (renderer.trim().length) {
      file += "\n\n";
      file += renderer;
    }

    if (wrapper.trim().length) {
      file += "\n\n";
      file += wrapper;
    }

    if (middleware.trim().length) {
      file += "\n\n";
      file += middleware;
    }
  }

  return file.trim().length ? file : null;
};

export const generateEntry = async (
  args: Route,
  parentModule: string | null,
  dir: string
) => {
  const script = generateScripts(args, parentModule, dir);
  if (!script) return;
  const name = nanoid(6); // TODO: generate id page based on path
  // TODO: create cache folder in abstracted place
  const scriptPath = path.join(
    dir,
    ".nlite",
    ".cache",
    "development",
    name + ".tsx"
  );
  await promises.writeFile(scriptPath, script, "utf-8");
  return `${name}.tsx`;
};
