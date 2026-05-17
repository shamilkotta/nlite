import { ErrorBoundary } from "nlite";
import AboutError from "./error";

export default async function AboutPage() {
  await new Promise((resolve) => setTimeout(resolve, 5000));
  console.log("This should be logged after 5 seconds in server");

  // throw new Error("This is a test error");

  return (
    <section className="stack">
      <h1>About</h1>
      <p>
        The v2 direction keeps framework concerns in a thin layer and lets Vite own the module
        graph, HMR, and environment builds.
      </p>
      <ErrorBoundary FallbackComponent={AboutError}>
        <Comp />
      </ErrorBoundary>
    </section>
  );
}

const Comp = () => {
  throw new Error("This is a test error");

  return <p>This is a test error</p>;
};
