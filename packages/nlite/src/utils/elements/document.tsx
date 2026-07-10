import React, { type PropsWithChildren, type ReactNode } from "react";

import { styles, scripts } from "virtual:nlite/assets";

import type { RouteMetadata } from "../../types.js";
import { createHeadNodes } from "../metadata/head.js";

export function Document({
  children,
  metadata,
  headExtras,
}: PropsWithChildren<{ metadata: RouteMetadata; headExtras?: ReactNode }>) {
  const headNodes = [
    scripts ? React.createElement("script", { key: "bootstrap", src: scripts }) : null,
    styles ? React.createElement("link", { key: "styles", rel: "stylesheet", href: styles }) : null,
    ...createHeadNodes(metadata, headExtras),
  ];

  return React.createElement(
    "html",
    { lang: "en" },
    React.createElement("head", null, ...headNodes),
    React.createElement("body", null, children),
  );
}
