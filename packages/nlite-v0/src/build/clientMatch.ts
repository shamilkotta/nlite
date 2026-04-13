import { Metafile } from "esbuild";
import { getRelativePath } from "../utils/resolveDir";
import path from "path";

export const clientMatch = (
  imports: string[],
  clientMeta: Metafile,
  clientExports: Map<string, string>,
  dir: string,
  file: string
) => {
  const matches: Record<string, string> = {};

  for (const imp of imports) {
    const clientExport = clientExports.get(imp);
    if (clientExport) {
      const relativePath = getRelativePath(dir, "", clientExport);
      for (const [key, value] of Object.entries(clientMeta.outputs)) {
        if (value.entryPoint === relativePath) {
          const relativeImport = getRelativePath(dir, path.dirname(file), key);
          matches[imp] = relativeImport;
          break;
        }
      }
      continue;
    }
  }

  return matches;
};
