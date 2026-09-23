"use client";

export default function ErrorFallback({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <main data-testid="error-fallback">
      <h1>Segment Error</h1>
      <p data-testid="error-message">{error.message}</p>
      <button type="button" data-testid="error-reset" onClick={reset}>
        Reset
      </button>
    </main>
  );
}
