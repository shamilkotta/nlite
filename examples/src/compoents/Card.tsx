import React from "react";
const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

async function Card() {
  await delay(5000);

  return (
    <div className="card">
      <button>count is {123}</button>
      <p>
        Edit <code>src/App.tsx</code> and save to test HMR
      </p>
    </div>
  );
}

export default Card;
