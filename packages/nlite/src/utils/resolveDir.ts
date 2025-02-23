/* eslint-disable @typescript-eslint/no-unused-vars */
import path, { dirname, parse } from "path";
import fs, { existsSync, promises, readdirSync } from "fs";
import { printAndExit } from "./";
import { warn } from "./console";

const isWindows = process.platform === "win32";

export const realpathSync = isWindows
  ? fs.realpathSync
  : fs.realpathSync.native;

export function getProjectDir(dir?: string, exitOnEnoent = true) {
  const resolvedDir = path.resolve(dir || ".");
  try {
    const realDir = realpathSync(resolvedDir);

    if (
      resolvedDir !== realDir &&
      resolvedDir.toLowerCase() === realDir.toLowerCase()
    ) {
      warn(
        `Invalid casing detected for project dir, received ${resolvedDir} actual path ${realDir}, see more info here https://nextjs.org/docs/messages/invalid-project-dir-casing`
      );
    }

    return realDir;
  } catch (err: any) {
    if (err.code === "ENOENT" && exitOnEnoent) {
      return printAndExit(
        `Invalid project directory provided, no such directory: ${resolvedDir}`
      );
    }
    throw err;
  }
}

export enum FileType {
  File = "file",
  Directory = "directory"
}

export async function fileExists(
  fileName: string,
  type?: FileType
): Promise<boolean> {
  try {
    if (type === FileType.File) {
      try {
        const stats = await promises.stat(`${fileName}.ts`);
        return stats.isFile();
      } catch (err: any) {
        /* empty */
      }
      try {
        const stats = await promises.stat(`${fileName}.js`);
        return stats.isFile();
      } catch (err: any) {
        /* empty */
      }

      return false;
    } else if (type === FileType.Directory) {
      const stats = await promises.stat(fileName);
      return stats.isDirectory();
    }

    return existsSync(fileName);
  } catch (err: any) {
    if (err.code === "ENOENT" || err.code === "ENAMETOOLONG") {
      return false;
    }
    throw err;
  }
}

export const getFile = (path: string) => {
  const files = readdirSync(dirname(path));
  const name = parse(path).base;
  const found = files.find((x) => x.indexOf(name) === 0);
  return dirname(path) + "/" + found;
};
