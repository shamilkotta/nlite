import { createRoot } from "react-dom/client";
// @ts-expect-error no declaration file
import { createFromFetch } from "react-server-dom-esm/client";
// import { ErrorBoundary } from "./_error";

// @ts-expect-error `root` might be null
const root = createRoot(document.getElementById("root"));

/**
 * Fetch your server component stream from `/rsc`
 * and render results into the root element as they come in.
 */
createFromFetch(fetch("/rsc")).then((comp: any) => {
  console.log(comp);
  root.render(comp);
});
