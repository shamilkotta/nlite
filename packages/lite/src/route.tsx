import React from 'react';
import App from './App';
import Card from './Card';
import Layout, { Error } from './layout';

/*
- index Route
- Nested route
- Dynamic route - [id] - /users/1
- Splats - /users/* - /users/1/2/3
*/

const routes: Route[] = [
  {
    path: '/',
    component: App,
    layout: Layout,
    error: Error,
    prerender: true,
    incremental: '1 day',
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
    path: '/about',
    component: Card,
    layout: Layout,
    error: Error,
    loading: () => <h1>Loading...</h1>,
    prerender: true,
    incremental: '1 day',
    middleWare: [],
    children: [
      {
        path: '/company',
        component: () => <h1>Company</h1>,
        prerender: false,
        middleWare: []
      }
    ]
  }
];

export default routes;
