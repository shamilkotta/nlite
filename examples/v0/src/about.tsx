import { PropsWithChildren } from "react";
import Counter from "./compoents/Counter";

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

async function About() {
  await delay(5000);

  return (
    <div className="card">
      <button>count is {123}</button>
      <p>
        Edit <code>src/App.tsx</code> and save to test HMR
      </p>
      <Counter />
    </div>
  );
}
export default About;

export const layout = ({ children }: PropsWithChildren) => {
  return (
    <div>
      <h1>About layout</h1>
      {children}
    </div>
  );
};

export const loading = () => {
  return <div>Loading about...</div>;
};
