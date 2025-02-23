const LOGGING_METHOD = {
  log: "log",
  warn: "warn",
  error: "error"
} as const;

function prefixedLog(
  prefixType: keyof typeof LOGGING_METHOD,
  ...message: any[]
) {
  if ((message[0] === "" || message[0] === undefined) && message.length === 1) {
    message.shift();
  }

  const consoleMethod: keyof typeof LOGGING_METHOD =
    prefixType in LOGGING_METHOD
      ? LOGGING_METHOD[prefixType as keyof typeof LOGGING_METHOD]
      : "log";

  if (message.length === 0) {
    console[consoleMethod]("");
  } else {
    if (message.length === 1 && typeof message[0] === "string") {
      console[consoleMethod](message[0]);
    } else {
      console[consoleMethod](...message);
    }
  }
}

export function bootstrap(...message: string[]) {
  console.log(message.join(" "));
}

export function wait(...message: any[]) {
  prefixedLog("log", ...message);
}

export function error(...message: any[]) {
  prefixedLog("error", ...message);
}

export function warn(...message: any[]) {
  prefixedLog("warn", ...message);
}

export function info(...message: any[]) {
  prefixedLog("log", ...message);
}
