import { promises } from "fs";
import path from "path";
import { transformWithEsbuild } from "vite";

export type Imports = {
  child: Script;
  module?: {
    element?: string | null;
    layout?: string | null;
    error?: string | null;
    loading?: string | null;
  };
  layout?: string;
  error?: string;
  loading?: string;
};

export type Script = {
  imports: string | null;
  renderer: string | null;
} | null;

export const generateScripts = (args: Imports): Script => {
  const { child, module, layout, error, loading } = args;

  let imports = "";
  let renderer = "";

  if (child?.imports) imports += child.imports;
  if (child?.renderer) renderer += child.renderer;

  let isModule = false;
  let isLayout = false;
  let isError = false;
  let isLoading = false;

  if (module?.element && (!child || !child.renderer)) {
    imports += `import Module from "${module.element}";\n`;
    isModule = true;
  }
  if (layout) {
    imports += `import Layout from "${layout}";\n`;
    isLayout = true;
  }
  if (error) {
    imports += `import Error from "${error}";\n`;
    imports += `import { ErrorBoundary } from "nlite";\n`;
    isError = true;
  }
  if (loading) {
    imports += `import Loading from "${loading}";\n`;
    imports += `import { Suspense } from "react";\n`;
    isLoading = true;
  }
  if (!layout && module?.layout) {
    imports += `import Layout from "${module.layout}";\n`;
    isLayout = true;
  }
  if (!error && module?.error) {
    imports += `import Error from "${module.error}";\n`;
    imports += `import { ErrorBoundary } from "nlite";\n`;
    isError = true;
  }
  if (!loading && module?.loading) {
    imports += `import Loading from "${module.loading}";\n`;
    imports += `import { Suspense } from "react";\n`;
    isLoading = true;
  }

  if (isModule) {
    renderer = `
        <Module>
          ${renderer}
        </Module>
    `;
  }

  if (isLoading) {
    renderer = `
        <Suspense fallback={<Loading />}>
          ${renderer}
        </Suspense>
    `;
  }

  if (isError) {
    renderer = `
        <ErrorBoundary fallbackRender={(props) => <Error {...props} />}>
          ${renderer}
        </ErrorBoundary>
    `;
  }

  if (isLayout) {
    renderer = `
        <Layout>
          ${renderer}
        </Layout>
    `;
  }

  return { imports, renderer };
};

export const generateEntry = async (scripts: Script, dir: string) => {
  let code = `
        import React, { StrictMode } from 'react'
        import { hydrateRoot } from 'react-dom/client'
    `;
  code += `${scripts!.imports}\n`;
  code += `
    hydrateRoot(
        document.getElementById('root'),
        <StrictMode>
            ${scripts!.renderer}
        </StrictMode>,
    )
  `;
  console.log({ code });

  const result = await transformWithEsbuild(code, "entry.jsx", {
    loader: "jsx"
  });

  const scriptPath = path.join(
    dir,
    ".nlite",
    "static",
    "development",
    "_entry.js"
  );
  await promises.writeFile(scriptPath, result.code);
};
