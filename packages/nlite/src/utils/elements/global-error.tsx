"use client";

import React from "react";

import type { ErrorBoundaryFallbackProps } from "../../lib/error-boundary.js";
import { STYLE_CLASS } from "../constants.js";

// Replaces the root layout when it throws, so it renders its own <html>, <head> and <body>
export function GlobalErrorElement(props: ErrorBoundaryFallbackProps): React.ReactElement {
  return React.createElement(
    "html",
    { lang: "en", style: { margin: 0, padding: 0 } },
    React.createElement("head", null, React.createElement("title", null, "Something went wrong")),
    React.createElement("body", null, React.createElement(GlobalErrorContent, props)),
  );
}

function GlobalErrorContent({ reset }: ErrorBoundaryFallbackProps): React.ReactElement {
  return React.createElement(
    "div",
    { className: STYLE_CLASS },
    React.createElement(
      "div",
      { className: `${STYLE_CLASS}__content` },
      React.createElement(
        "svg",
        {
          xmlns: "http://www.w3.org/2000/svg",
          width: 40,
          height: 40,
          viewBox: "0 0 24 24",
          fill: "none",
          stroke: "currentColor",
          strokeWidth: 1.5,
          "aria-hidden": true,
          className: `${STYLE_CLASS}__icon`,
        },
        React.createElement("path", {
          strokeLinecap: "round",
          strokeLinejoin: "round",
          d: "M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z",
        }),
      ),
      React.createElement("h1", { className: `${STYLE_CLASS}__title` }, "Something went wrong"),
      React.createElement(
        "p",
        { className: `${STYLE_CLASS}__description` },
        "An unexpected error occurred. Try again or reload the page.",
      ),
      React.createElement(
        "div",
        { className: `${STYLE_CLASS}__actions` },
        React.createElement(
          "button",
          {
            type: "button",
            onClick: reset,
            className: `${STYLE_CLASS}__btn ${STYLE_CLASS}__btn--primary`,
          },
          "Try again",
        ),
        React.createElement(
          "button",
          {
            type: "button",
            onClick: () => window.location.reload(),
            className: `${STYLE_CLASS}__btn ${STYLE_CLASS}__btn--secondary`,
          },
          "Reload",
        ),
      ),
    ),
  );
}
