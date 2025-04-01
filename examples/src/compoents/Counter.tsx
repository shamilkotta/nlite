"use client";
import { useState } from "react";
import "./count.css";
import Inner from "./Inner";

const Counter = () => {
  const [count, setCount] = useState(0);
  return (
    <div>
      <h1>Count: {count}</h1>
      <button onClick={() => setCount(count + 1)}>Increment</button>
      <button onClick={() => setCount(count - 1)}>Decrement</button>
      <Inner />
    </div>
  );
};

export default Counter;
