import { createContext, use } from "react";
// @ts-expect-error idk what happens here but it works
import { createFromFetch } from "react-server-dom-esm/client";

const RouterContext = createContext({
  navigate: () => {}
});
const Router = () => {
  const cache = createFromFetch(fetch("/rsc"));

  const navigate = () => {};

  return (
    <RouterContext.Provider value={{ navigate }}>
      {use(cache)}
    </RouterContext.Provider>
  );
};

export default Router;
