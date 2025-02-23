import React, { StrictMode } from "react";
import {
  type RenderToPipeableStreamOptions,
  renderToPipeableStream
} from "react-dom/server";

export function render(
  _url: string,
  App: React.ReactElement,
  options?: RenderToPipeableStreamOptions
) {
  return renderToPipeableStream(<StrictMode>{App}</StrictMode>, options);
}
