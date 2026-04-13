import { fileURLToPath } from "url";
import path from "path";
import fs from "fs/promises";

export const parseValidPositiveInteger = (value: string) => {
  const parsedValue = parseInt(value, 10);

  if (isNaN(parsedValue) || !isFinite(parsedValue) || parsedValue < 0) {
    throw new Error(`'${value}' is not a non-negative number.`);
  }
  return parsedValue;
};

export const printAndExit = (message: string, code = 1) => {
  if (code === 0) {
    console.log(message);
  } else {
    console.error(message);
  }

  return process.exit(code);
};

const copyDirectory = async (
  srcDir: string,
  destDir: string,
  options?: { includes?: string[]; excludes?: string[] }
) => {
  await fs.mkdir(destDir, { recursive: true });
  const entries = await fs.readdir(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      await copyDirectory(srcPath, destPath);
    } else {
      if (options?.includes && !options.includes.includes(entry.name)) continue;
      if (options?.excludes && options.excludes.includes(entry.name)) continue;
      await fs.copyFile(srcPath, destPath);
    }
  }
};

// TODO: remove this function
export const copyNliteStaticFiles = async () => {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const nliteStaticDir = path.join(__dirname, "..", "static");
  const targetDir = path.join(process.cwd(), ".nlite", "static");
  await copyDirectory(nliteStaticDir, targetDir, { includes: ["_entry.js"] });
};

export const staticImportReplace = (input: string) => {
  return input.replace(
    /from\s*["'](\.\.\/static\/[^"']*|\.\.\/\.\.\/static\/[^"']*)["']/g,
    (_, importPath) => {
      const newPath = importPath.replace(
        /\.\.\/(\.\.\/)?static\//g,
        "/_nlite/"
      );
      return `from "${newPath}"`;
    }
  );
};

export const getStaticImports = (input: string) => {
  // find clinet component imports
  const regex = /from\s*["'](\/_nlite\/[^"']*)["']/g;
  const matches = [];
  let match;

  while ((match = regex.exec(input)) !== null) {
    matches.push(match[1]);
  }

  return matches;
};

export const staticAssignementReplace = (input: string, base?: string) => {
  // find static files import / assignement and replace it with static path

  if (base == "static") {
    return input.replace(
      /(const|let|var)\s+(\w+)\s*=\s*(["'])(\.{1,2}\/media\/[^"']*?)(\3)/g,
      (_, decl, varName, openQuote, path, closeQuote) => {
        const newPath = path.replace(/\.{1,2}\/media\//, "/_nlite/media/");
        return `${decl} ${varName} = ${openQuote}${newPath}${closeQuote}`;
      }
    );
  }

  return input.replace(
    /(const|let|var)\s+(\w+)\s*=\s*(["'])(\.\.\/?static\/[^"']*?)(\3)/g,
    (_, decl, varName, openQuote, path, closeQuote) => {
      const newPath = path.replace(/\.\.\/(\.\.\/)?static\//, "/_nlite/");
      return `${decl} ${varName} = ${openQuote}${newPath}${closeQuote}`;
    }
  );
};

export const convertNliteToStatic = (input: string, replacer = "../static") => {
  return input.replace(
    /from\s*["'](\/_nlite\/[^"']*)["']/g,
    (_, path) => `from "${replacer}${path.slice(7)}"`
  );
};