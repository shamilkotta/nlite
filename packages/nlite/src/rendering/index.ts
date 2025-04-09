import path from "path";
import { fork } from "node:child_process";

import RouteTrie from "../server/routeTrie";
import { printAndExit } from "../utils";
// import { render } from "./render";
import { ssg } from "./ssg";

const __dirname = path.dirname(new URL(import.meta.url).pathname);

export const renderPaths = async (
  dir: string,
  routeTree: RouteTrie,
  store: {
    path: string;
    file: string;
  }[]
) => {
  // start a child process for react client
  const controller = new AbortController();
  const client = fork(path.join(__dirname, "./ssg.client.js"), {
    signal: controller.signal,
    stdio: ["inherit", "inherit", "inherit", "ipc"],
    serialization: "advanced", // Allows Buffer transfer,
    execArgv: ["--conditions=default"]
  });
  // register client events
  const clientStderr = (data: any) => console.error(`${data}`);
  const clientErr = (err: Error) => {
    client.kill();
    printAndExit(err.message);
  };
  const clientExit = () =>
    clientErr(new Error("Client process exited unexpectedly"));
  client.on("exit", clientExit);
  client.on("error", clientErr);
  client.stderr?.on("data", clientStderr);

  try {
    for (const route of store) {
      const routePath = route.path;
      const module = routeTree.match(routePath);
      if (!module || !module.match) {
        client.kill();
        printAndExit(`Something went wrong with rendering ${routePath}`);
        return;
      }
      const moduleData = module.match;
      if (moduleData.rendering == "ssr") continue;

      if (moduleData.rendering == "ssg") {
        const resp = await ssg(dir, moduleData, client);
        if (!resp) continue;
        const { html, rsc } = resp;
        console.log({ html, rsc });

        moduleData.shell = html;
        moduleData.rsc = rsc;
      } else {
        // const { html } = await render(dir, moduleData);
        // moduleData.shell = html;
      }
    }
  } finally {
    client.stderr?.off("data", clientStderr);
    client.off("error", clientErr);
    client.off("exit", clientExit);
    client.kill();
  }
};

export const generateTags = (css: string[]) => {
  return css.map((val) => {
    const name = path.parse(val).name;
    const pathFirstInd = val.lastIndexOf("/static");
    const link = `/_nlite/${val.slice(pathFirstInd)}`;
    return { name, link };
  });
};
