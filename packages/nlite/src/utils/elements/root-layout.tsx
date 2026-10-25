import React, { type PropsWithChildren } from "react";

/** Fallback used only when a route has no root layout at all */
export function DefaultRootLayout({ children }: PropsWithChildren) {
  return React.createElement("html", { lang: "en" }, React.createElement("body", null, children));
}
