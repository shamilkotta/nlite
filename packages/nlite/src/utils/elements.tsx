import React from "react";

export function Document({ children, pathname }: { children: React.ReactNode; pathname: string }) {
  return React.createElement(
    "html",
    { lang: "en" },
    React.createElement(
      "head",
      null,
      React.createElement("meta", { charSet: "utf-8" }),
      React.createElement("meta", {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      }),
      React.createElement("link", {
        rel: "icon",
        href: "/favicon.ico",
        sizes: "any",
      }),
      import.meta.viteRsc.loadCss(),
    ),
    React.createElement(
      "body",
      null,
      React.createElement("script", {
        dangerouslySetInnerHTML: {
          __html: INLINE_BOOTSTRAP_SCRIPT,
        },
      }),
      React.createElement("script", {
        dangerouslySetInnerHTML: {
          __html: "window.__NLITE_DATA__=" + JSON.stringify({ pathname }),
        },
      }),
      children,
    ),
  );
}

const INLINE_BOOTSTRAP_SCRIPT = [
  "(() => {",
  "  const encoder = new TextEncoder();",
  "  let controller = null;",
  "  let closed = false;",
  "  const pending = [];",
  "  const stream = new ReadableStream({",
  "    start(nextController) {",
  "      controller = nextController;",
  "      for (const chunk of pending) controller.enqueue(encoder.encode(chunk));",
  "      if (closed) controller.close();",
  "    }",
  "  });",
  "  window.__NLITE_READ_RSC__ = () => stream;",
  "  window.__NLITE_PUSH_RSC__ = (chunk) => {",
  "    if (controller) {",
  "      controller.enqueue(encoder.encode(chunk));",
  "      return;",
  "    }",
  "    pending.push(chunk);",
  "  };",
  "  window.__NLITE_CLOSE_RSC__ = () => {",
  "    closed = true;",
  "    if (controller) controller.close();",
  "  };",
  "})();",
].join("");

export function DefaultNotFoundElement(): React.ReactElement {
  return React.createElement(
    "div",
    {
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        margin: 0,
        fontFamily: 'system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        background: "#000",
        color: "#fff",
      },
    },
    React.createElement(
      "div",
      { style: { display: "flex", alignItems: "center" } },
      React.createElement(
        "h1",
        {
          style: {
            margin: 0,
            paddingRight: 24,
            fontSize: 24,
            fontWeight: 500,
            lineHeight: "49px",
            borderRight: "1px solid rgba(255,255,255,.3)",
          },
        },
        "404",
      ),
      React.createElement(
        "div",
        { style: { paddingLeft: 24, fontSize: 14, lineHeight: "49px" } },
        "This page could not be found.",
      ),
    ),
  );
}
