import React, { type PropsWithChildren } from "react";

export function DefaultRootLayout({ children }: PropsWithChildren) {
  return React.createElement(
    "html",
    { lang: "en", style: { margin: 0, padding: 0 } },
    React.createElement("body", null, children),
  );
}
