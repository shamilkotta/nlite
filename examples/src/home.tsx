import { PropsWithChildren, Suspense } from "react";
import "./App.css";
import "./index.css";
import reactLogo from "./assets/react.svg";
import Card from "./compoents/Card";

export const layout = ({ children }: PropsWithChildren) => {
  return (
    <div>
      <h1>Layout</h1>
      {children}
    </div>
  );
};

function App() {
  return (
    <>
      <div>
        <a href="https://vite.dev" target="_blank" rel="noreferrer">
          <img src="/vite.svg" className="logo" alt="Vite logo" />
        </a>
        <a href="https://reactjs.org" target="_blank" rel="noreferrer">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
        <button>Test button</button>
      </div>
      <h1>Nlite</h1>

      <Suspense fallback={<p>Loading card component...</p>}>
        <Card />
      </Suspense>

      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
    </>
  );
}

export default App;
