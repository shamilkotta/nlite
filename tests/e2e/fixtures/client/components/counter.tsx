"use client";

import { useState } from "react";

export function Counter({ initial, label }: { initial: number; label: string }) {
  const [count, setCount] = useState(initial);
  return (
    <div>
      <p id="counter-label">{label}</p>
      <button id="increment" type="button" onClick={() => setCount((value) => value + 1)}>
        increment
      </button>
      <p id="count">{count}</p>
    </div>
  );
}
