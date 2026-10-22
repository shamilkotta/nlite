"use client";

import type { ErrorBoundaryFallbackProps } from "nlite";

export default function ClientError({ error, reset }: ErrorBoundaryFallbackProps) {
  return (
    <div>
      <p id="client-error">{error.message}</p>
      <button id="reset" type="button" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
