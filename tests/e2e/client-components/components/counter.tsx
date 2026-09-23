"use client";

import { useState } from "react";

export function Counter() {
  const [count, setCount] = useState(0);
  return (
    <div data-testid="counter">
      <p data-testid="count">{count}</p>
      <button type="button" data-testid="increment" onClick={() => setCount((v) => v + 1)}>
        Increment
      </button>
    </div>
  );
}
