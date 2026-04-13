import { readFile } from "fs/promises";
import { Loader, transform } from "esbuild";

export const readFileContent = async (
  filePath: string,
  loader: Loader = "ts"
) => {
  const content = await readFile(filePath);
  const modules = await transform(content.toString(), {
    format: "esm",
    loader: loader,
    treeShaking: true,
    minify: true
  });

  return import(`data:text/javascript,${encodeURIComponent(modules.code)}`);
};
