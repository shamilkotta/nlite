"use client";

import { useState } from "react";

export function Counter() {
  const [count, setCount] = useState(0);
  return (
    <button id="count" type="button" onClick={() => setCount(count + 1)}>
      {count}
    </button>
  );
}
