"use client";

import { useState } from "react";

export function FlakyButton() {
  const [broken, setBroken] = useState(false);
  if (broken) {
    throw new Error("client render failure");
  }
  return (
    <button id="break" type="button" onClick={() => setBroken(true)}>
      break me
    </button>
  );
}
