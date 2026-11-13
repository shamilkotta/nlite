"use client";

import type { ErrorBoundaryFallbackProps } from "nlite";

export default function ErrorPage({ reset }: ErrorBoundaryFallbackProps) {
  return (
    <main>
      <h1>Something went wrong</h1>
      <button type="button" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
