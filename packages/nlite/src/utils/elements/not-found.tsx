import React from "react";

import { STYLE_CLASS } from "../constants.js";

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
