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

export const copyNliteStaticFiles = async () => {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const nliteStaticDir = path.join(__dirname, "..", "static");
  const targetDir = path.join(process.cwd(), ".nlite", "static");
  await copyDirectory(nliteStaticDir, targetDir, { includes: ["_entry.js"] });
};
