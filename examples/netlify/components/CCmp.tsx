"use client";

import { useState } from "react";

export default function CCmp() {
  const [count, setCount] = useState(0);
  return (
    <div>
      <h1>CCmp</h1>
      <p>Count: {count}</p>
      <button onClick={() => setCount(count + 1)}>Increment</button>
    </div>
  );
}
