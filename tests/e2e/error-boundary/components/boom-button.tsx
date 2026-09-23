"use client";

import { useState } from "react";

export function BoomButton() {
  const [boom, setBoom] = useState(false);
  if (boom) throw new Error("Intentional boom");
  return (
    <button type="button" data-testid="boom-button" onClick={() => setBoom(true)}>
      Boom
    </button>
  );
}
