"use client";

import type { ErrorBoundaryFallbackProps } from "nlite";

export default function DemoError({ error, reset }: ErrorBoundaryFallbackProps) {
  return (
    <div className="error-fallback">
      <p>{error.message}</p>
      <button className="button button-ghost" type="button" onClick={() => reset()}>
        Try again
      </button>
    </div>
  );
}
