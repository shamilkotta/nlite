import { type Route } from "nlite";

/*
- index Route
- Nested route
- Dynamic route - [id] - /users/1
- Splats - /users/* - /users/1/2/3
*/

const routes: Route[] = [
  {
    path: "/",
    module: "/src/home",
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
    module: "./about",
    layout: "./layout",
    prerender: true,
    incremental: "1 day",
    middleWare: [],
    children: [
      {
        path: "/company",
        module: "./company",
        layout: "./layout",
        prerender: false,
        middleWare: []
      }
    ]
  }
];

export default routes;
