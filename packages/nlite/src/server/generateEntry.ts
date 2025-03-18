import { promises } from "fs";
import path from "path";
import { nanoid } from "nanoid";

import { getRelativePath } from "../utils/resolveDir";
import { Route } from "..";

const cachePath = ".nlite/.cache/development";
const generateScripts = (
  args: Route,
  parentModule: string,
  dir: string
): string | null => {
  const { element, layout, error, loading } = args;

  let imports = "";
  let renderer = "";
  let wrapper = "{ children }";

  if (element)
    imports += `import Element from "${getRelativePath(dir, cachePath, element)}";\n`;
  if (layout) {
    imports += `import Layout from "${getRelativePath(dir, cachePath, layout)}";\n`;
  }
  if (error) {
    imports += `import Error from "${getRelativePath(dir, cachePath, error)}";\n`;
    imports += `import { ErrorBoundary } from "nlite";\n`;
  }
  if (loading) {
    imports += `import Loading from "${getRelativePath(dir, cachePath, loading)}";\n`;
    imports += `import { Suspense } from "react";\n`;
  }
  if (parentModule)
    // TODO:
    imports += `import { Layout as Prent } from "${parentModule}";\n`;

  // render layout
  if (loading) {
    wrapper = `<Suspense fallback={<Loading />}>${wrapper}</Suspense>`;
  }
  if (error) {
    wrapper = `<ErrorBoundary fallback={<Error />}>${wrapper}</ErrorBoundary>`;
  }
  if (layout) {
    wrapper = `<Layout>${wrapper}</Layout>`;
  }

  if (parentModule) {
    wrapper = `<Parent>${wrapper}</Parent>`;
  }

  wrapper = `
    export const Layout = ({ children }) => {
     return (<>$${wrapper}</>);
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
    file += imports;
    if (renderer.trim().length) {
      file += "\n\n";
      file += renderer;
    }

    if (wrapper.trim().length) {
      file += "\n\n";
      file += wrapper;
    }
  }

  return file.trim().length ? file : null;
};

export const generateEntry = async (
  args: Route,
  parentModule: string,
  dir: string
) => {
  const script = generateScripts(args, parentModule, dir);
  if (!script) return null;
  const name = nanoid(6); // todo generate id page based on path
  const scriptPath = path.join(
    dir,
    ".nlite",
    ".cache",
    "development",
    name + ".ts"
  );
  await promises.writeFile(scriptPath, script, "utf-8");
  return `${name}.ts`;
};
