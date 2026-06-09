import React, { type PropsWithChildren, type ReactNode } from "react";

import { styles, scripts } from "virtual:nlite/assets";

import type { RouteMetadata } from "../../types.js";

export function Document({
  children,
  metadata,
  headExtras,
}: PropsWithChildren<{ metadata: RouteMetadata; headExtras?: ReactNode }>) {
  return React.createElement(
    "html",
    { lang: "en" },
    React.createElement(
      "head",
      null,
      scripts ? React.createElement("script", { src: scripts }) : null,
      styles ? React.createElement("link", { rel: "stylesheet", href: styles }) : null,
      React.createElement("meta", { charSet: "utf-8" }),
      React.createElement("meta", {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      }),
      React.createElement("title", null, metadata.title),
      React.createElement("meta", {
        name: "description",
        content: metadata.description,
      }),
      React.createElement("link", {
        rel: "icon",
        href: "/favicon.ico",
        sizes: "any",
      }),
      headExtras,
    ),
    React.createElement(
      "body",
      null,
      React.createElement("script", {
        dangerouslySetInnerHTML: {
          __html: "window.__NLITE_DATA__=" + JSON.stringify({ pathname: metadata.pathname }),
        },
      }),
      children,
    ),
  );
}
