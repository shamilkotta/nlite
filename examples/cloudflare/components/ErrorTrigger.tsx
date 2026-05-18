"use client";

import { useState } from "react";

export function ErrorTrigger() {
  const [shouldThrow, setShouldThrow] = useState(false);

  if (shouldThrow) {
    throw new Error("Demo error triggered from a client component.");
  }

  return (
    <button className="button" type="button" onClick={() => setShouldThrow(true)}>
      Trigger error
    </button>
  );
}
