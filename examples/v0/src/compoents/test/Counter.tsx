"use client";
import { useState } from "react";
import "../count.css";
import Image from "../../assets/images/react.svg";
import Inner from "../Inner";

const Counter = () => {
  const [count, setCount] = useState(0);
  return (
    <div>
      <h1>Count: {count}</h1>
      <img src={Image} alt="New log" />
      <button onClick={() => setCount(count + 1)}>Increment</button>
      <button onClick={() => setCount(count - 1)}>Decrement</button>
      <Inner />
    </div>
  );
};

export default Counter;
