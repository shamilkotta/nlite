#!/usr/bin/env node

import { Command, Option } from "commander";
import { parseValidPositiveInteger } from "../utils/index.js";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { version } = require("../../package.json");

class NliteCommand extends Command {
  createCommand(name: string) {
    const command = new Command(name);

    command.hook("preAction", (event) => {
      const commandName = event.name();
      const prodCommands = ["build", "start"];
      const defaultEnv = prodCommands.includes(commandName)
        ? "production"
        : "development";
      process.env.NODE_ENV = defaultEnv;
      process.env.NEXT_RUNTIME = "nodejs";
    });

    return command;
  }
}

const program = new NliteCommand();

program
  .name("nlite")
  .description(
    "The Nlite CLI allows you to develop, build, start your application, and more."
  )
  .helpCommand(true)
  .version(`Nlite v${version}`, "-v, --version", "Outputs the Nlite version.");

program
  .command("build")
  .description(
    "Creates an optimized production build of your application. The output displays information about each route."
  )
  .argument(
    "[directory]",
    `A directory on which to build the application. ${"If no directory is provided, the current directory will be used."}`
  )
  .action((directory: string, options) =>
    import("../cli/nlite-build.js").then((mod) =>
      mod.nliteBuild(options, directory)
    )
  )
  .usage("[directory] [options]");

program
  .command("dev", { isDefault: true })
  .description(
    "Starts Nlite in development mode with HMR, error reporting, and more."
  )
  .argument(
    "[directory]",
    `A directory on which to build the application. ${"If no directory is provided, the current directory will be used."}`
  )
  .addOption(
    new Option(
      "-p, --port <port>",
      "Specify a port number on which to start the application."
    )
      .argParser(parseValidPositiveInteger)
      .default(5173)
      .env("PORT")
  )
  // .option(
  //   "-H, --hostname <hostname>",
  //   "Specify a hostname on which to start the application (default: 0.0.0.0)."
  // )
  // .option(
  //   "--experimental-https",
  //   "Starts the server with HTTPS and generates a self-signed certificate."
  // )
  //   .option("--experimental-https-key, <path>", "Path to a HTTPS key file.")
  //   .option(
  //     "--experimental-https-cert, <path>",
  //     "Path to a HTTPS certificate file."
  //   )
  //   .option(
  //     "--experimental-https-ca, <path>",
  //     "Path to a HTTPS certificate authority file."
  //   )
  .action((directory: string, options) => {
    import("../cli/nlite-dev.js").then((mod) =>
      mod.startServer(options, options.port, directory)
    );
  })
  .usage("[directory] [options]");

program
  .command("start")
  .description("Starts nlite server")
  .argument(
    "[directory]",
    `A directory on which to build the application. ${"If no directory is provided, the current directory will be used."}`
  )
  .addOption(
    new Option(
      "-p, --port <port>",
      "Specify a port number on which to start the application."
    )
      .argParser(parseValidPositiveInteger)
      .default(5173)
      .env("PORT")
  )
  // .option(
  //   "-H, --hostname <hostname>",
  //   "Specify a hostname on which to start the application (default: 0.0.0.0)."
  // )
  // .option(
  //   "--experimental-https",
  //   "Starts the server with HTTPS and generates a self-signed certificate."
  // )
  //   .option("--experimental-https-key, <path>", "Path to a HTTPS key file.")
  //   .option(
  //     "--experimental-https-cert, <path>",
  //     "Path to a HTTPS certificate file."
  //   )
  //   .option(
  //     "--experimental-https-ca, <path>",
  //     "Path to a HTTPS certificate authority file."
  //   )
  .action((directory: string, options) => {
    import("../cli/nlite-start.js").then((mod) =>
      mod.startServer(options, options.port, directory)
    );
  })
  .usage("[directory] [options]");

program.parse(process.argv);
