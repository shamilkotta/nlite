import fs from "fs";
import { ModuleNode, ViteDevServer } from "vite";

import { getFile } from "../../utils/resolveDir";

export const componentsModules = (element: string, vite: ViteDevServer) => {
  const matchedModules = new Set<ModuleNode>();
  const path = getFile(element);
  const modules = vite.moduleGraph.getModulesByFile(path);
  modules?.forEach((mod) => matchedModules.add(mod));
  return matchedModules;
};

/**
 * Collect SSR CSS for Vite
 */
export const collectCss = (
  mods: Set<ModuleNode>,
  styles = new Map<string, string>(),
  checkedComponents = new Set()
) => {
  for (const mod of mods) {
    if (
      (mod.file?.endsWith(".scss") || mod.file?.endsWith(".css")) &&
      mod.ssrModule
    ) {
      const data = fs.readFileSync(mod.file, "utf-8");
      styles.set(mod.url, data || "");
    }
    if (mod.importedModules.size > 0 && !checkedComponents.has(mod.id)) {
      checkedComponents.add(mod.id);
      collectCss(mod.importedModules, styles, checkedComponents);
    }
  }
  let result = "";
  styles.forEach((content, id) => {
    const styleTag = `<style type="text/css" vite-module-id="${hashCode(id)}">${content}</style>`;
    result = result.concat(styleTag);
  });
  return result;
};

/**
 * Client listener to detect updated modules through HMR, and remove the initial styled attached to the head
 */
export const removeCssHotReloaded = () => {
  // if (import.meta.hot) {
  //   import.meta.hot.on("vite:beforeUpdate", (module: UpdatePayload) => {
  //     module.updates.forEach((update) => {
  //       const moduleStyle = document.querySelector(
  //         `[vite-module-id="${hashCode(update.acceptedPath)}"]`
  //       );
  //       if (moduleStyle) {
  //         moduleStyle.remove();
  //       }
  //     });
  //   });
  // }
};

const hashCode = (moduleId: string) => {
  let hash = 0,
    i,
    chr;
  if (moduleId.length === 0) return hash;
  for (i = 0; i < moduleId.length; i++) {
    chr = moduleId.charCodeAt(i);
    hash = (hash << 5) - hash + chr;
    hash |= 0; // Convert to 32bit integer
  }
  return hash;
};
