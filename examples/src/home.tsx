import React, { PropsWithChildren, Suspense } from "react";
import "./App.css";
import reactLogo from "./assets/react.svg";
import Card from "./compoents/Card";

export const layout = ({ children }: PropsWithChildren) => {
  return (
    <div>
      <h1>Home layout</h1>
      {children}
    </div>
  );
};

function App() {
  return (
    <>
      <div style={{ backgroundColor: "red" }}>
        <a href="https://vite.dev" target="_blank" rel="noreferrer">
          <img src="/vite.svg" className="logo" alt="Vite logo" />
        </a>
        <a href="https://reactjs.org" target="_blank" rel="noreferrer">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>Vite + React</h1>

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
