import React from "react";

import "../assets/styles.css";
import { STYLE_CLASS } from "./constants.js";

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
          __html: "window.__NLITE_DATA__=" + JSON.stringify({ pathname }),
        },
      }),
      children,
    ),
  );
}

export function DefaultNotFoundElement(): React.ReactElement {
  return React.createElement(
    "div",
    { className: STYLE_CLASS },
    React.createElement(
      "div",
      { className: `${STYLE_CLASS}__not-found` },
      React.createElement("h1", { className: `${STYLE_CLASS}__code` }, "404"),
      React.createElement(
        "div",
        { className: `${STYLE_CLASS}__message` },
        "This page could not be found.",
      ),
    ),
  );
}
