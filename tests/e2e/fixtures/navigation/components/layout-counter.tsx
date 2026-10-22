"use client";

import { useState } from "react";

export function LayoutCounter() {
  const [count, setCount] = useState(0);
  return (
    <button id="layout-counter" type="button" onClick={() => setCount((value) => value + 1)}>
      layout:{count}
    </button>
  );
}
