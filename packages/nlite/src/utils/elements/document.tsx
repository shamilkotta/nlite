import React, { type ReactNode } from "react";

import { styles } from "virtual:nlite/assets";

import type { RouteMetadata } from "../../types.js";
import { createHeadNodes } from "../metadata/head.js";

/**
 * Rendered by SSR and the browser (never by the RSC environment) as a sibling before the user's
 * root layout. Everything here is hoistable (`<title>`, `<meta>`, `<link>`), so React moves it
 * into the `<head>` owned by the root layout and updates it on navigation.
 */
export function AppHead({ metadata }: { metadata: RouteMetadata }) {
  return React.createElement(
    React.Fragment,
    null,
    styles
      ? React.createElement("link", { rel: "stylesheet", href: styles, precedence: "nlite" })
      : null,
    ...createHeadNodes(metadata),
  );
}

/**
 * Minimal document used where the user's root layout cannot render: the shells sent when a
 * redirect or not-found is thrown before any bytes were flushed.
 */
export function ShellDocument({ headExtras }: { headExtras?: ReactNode }) {
  return React.createElement(
    "html",
    null,
    React.createElement(
      "head",
      null,
      styles ? React.createElement("link", { rel: "stylesheet", href: styles }) : null,
      ...createHeadNodes({}, headExtras),
    ),
    React.createElement("body"),
  );
}
