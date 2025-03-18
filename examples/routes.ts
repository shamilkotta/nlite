import { type Route } from "nlite";

/*
- index Route
- Nested route
- Dynamic route - [id] - /users/1
- Splats - /users/* - /users/1/2/3
- no routes (paths) - just for layout
*/

const routes: Route[] = [
  {
    path: "/",
    module: "./src/home.tsx",
    prerender: true,
    incremental: "1 day",
    middleWare: [],
    children: [
      // {
      //   path: "/about",
      //   component: "About",
      //   layout: "AboutLayout",
      //   error: "AboutError",
      //   prerender: false,
      //   middleWare: [],
      // },
    ]
  },
  {
    path: "/about",
    module: "./src/about.tsx",
    layout: "./src/layout.tsx",
    prerender: true,
    incremental: "1 day",
    middleWare: [],
    children: [
      {
        path: "/company",
        module: "./src/company.tsx",
        layout: "./src/layout.tsx",
        prerender: false,
        middleWare: []
      }
    ]
  }
];

export default routes;
