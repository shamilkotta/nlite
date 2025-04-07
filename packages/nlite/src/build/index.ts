import { Loader, OutputFile } from "esbuild";
import path from "path";
import { writeFile } from "fs/promises";
import { parse } from "es-module-lexer";

import {
  copyNliteStaticFiles,
  getStaticImports,
  staticAssignementReplace
} from "../utils";
import { serverBuild } from "./server";
import { clientBuild } from "./client";
import { clientMatch } from "./clientMatch";
import { getFileName } from "../utils/readBuild";
import { getRelativePath } from "../utils/resolveDir";

export const loader: { [ext: string]: Loader } = {
  ".png": "file",
  ".jpg": "file",
  ".jpeg": "file",
  ".gif": "file",
  ".svg": "file",
  ".mp4": "file",
  ".webm": "file",
  ".css": "css"
};

export const build = async (
  routeList: {
    path: string;
    file: string;
  }[],
  dir: string,
  env = "prod"
) => {
  const buildPath = path.join(dir, ".nlite");
  const clientExports = new Map<string, string>();
  // server component build
  const { serverOutputs, clientEntryPoints } = await serverBuild(
    routeList,
    buildPath,
    dir,
    env,
    clientExports
  );
  // client component build
  const { clientOutpus } = await clientBuild(clientEntryPoints, buildPath, env);

  // write server builds to server folder
  for (const file of serverOutputs.outputFiles) {
    if (file.path.endsWith(".css")) {
      writeStaticFiles(buildPath, file, "css");
      continue;
    }

    if (file.path.endsWith(".js")) {
      let text = file.text;

      // assetes file import from static folder
      text = staticAssignementReplace(text);

      // replace client component import to static file with current name
      const clientImports = getStaticImports(text);

      // find curresponding client component from static folder
      // and replace import with static file
      const clientMatches = clientMatch(
        clientImports,
        clientOutpus.metafile,
        clientExports,
        dir,
        file.path
      );
      for (const [key, val] of Object.entries(clientMatches)) {
        text = text.replaceAll(key, val);
      }

      writeFile(file.path, text);
    }
  }

  // write client builds to static folder
  const clientEntries = [...clientEntryPoints];
  for (const file of clientOutpus.outputFiles) {
    if (file.path.endsWith(".css")) {
      writeStaticFiles(buildPath, file, "css");
      continue;
    }

    let newContents = file.text;
    const fileName = getFileName(file.path);
    if (
      !file.path.includes("/chunks/") &&
      clientEntries.find((el) => path.parse(el).name == fileName)
    ) {
      const [, exports] = parse(file.text);
      for (const exp of exports) {
        // add refernce for server component
        const key = `/_nlite/${getRelativePath(dir, ".nlite/static", file.path)}#${exp.n}`;
        newContents += `${exp.ln}.$$id = ${JSON.stringify(key)};\n`;
        newContents += `${exp.ln}.$$typeof = Symbol.for("react.client.reference");`;
      }
    }

    writeFile(file.path, newContents);
  }

  // copy prebuilt entry file and other global wrappers
  await copyNliteStaticFiles();
};

const writeStaticFiles = (
  buildPath: string,
  file: OutputFile,
  folder: string
) => {
  return writeFile(
    path.join(buildPath, "static", folder, file.path.split("/").slice(-1)[0]),
    file.text
  );
};
