// import React, { StrictMode } from "react";
// import { ViteDevServer } from "vite";
// import path from "path";

// import Loader from "../../_loader";
// import { collectCss, componentsModules } from "./parseCss";
// import { generateScripts, Imports } from "../generateEntry";
// import { Route } from "../..";

// type ParsedElement = {
//   jsx: React.ReactElement | null;
//   styles: string | null;
//   script: {
//     imports: string | null;
//     renderer: string | null;
//   } | null;
// };

// export const parseRoute = async (
//   url: string,
//   routeList: Route[],
//   vite: ViteDevServer,
//   dir: string
// ): Promise<ParsedElement> => {
//   // Clean the URL by removing trailing slashes, except for root path "/"
//   const cleanUrl = url === "/" ? url : url.replace(/\/+$/, "");

//   // Split URL into segments, remove empty first segment, and prefix each with "/"
//   // Example: "/users/profile" -> ["/users", "/profile"]
//   const urlSegments = cleanUrl
//     .split("/")
//     .filter((_, ind) => ind !== 0) // Skip first empty segment from split
//     .map((segment) => `/${segment}`);

//   for (const route of routeList) {
//     let isRouteMatch = true;
//     let isSplatMatch = false;

//     if (route.path) {
//       // Normalize the route path:
//       // - For root path "/", keep as-is
//       // - For other paths, ensure single leading slash and no trailing slashes
//       const routePath =
//         route.path === "/"
//           ? route.path
//           : "/" + route.path.replace(/^\/*(.*?)\/*$/, "$1");

//       // Convert route path into segments:
//       // 1. Split path on "/"
//       // 2. Remove empty first segment from split
//       // 3. Add leading slash to each segment
//       // Example: "/users/profile" -> ["/users", "/profile"]
//       const routeSegments = routePath
//         .split("/")
//         .filter((_, ind) => ind !== 0)
//         .map((segment) => `/${segment}`);

//       for (let i = 0; i < routeSegments.length; i++) {
//         const routeSegement = routeSegments[i];
//         const urlSegment = urlSegments.shift();

//         if (!urlSegment) {
//           isRouteMatch = false;
//           break;
//         }

//         // splat match
//         if (routeSegement === "/*") {
//           isSplatMatch = true;
//           isRouteMatch = true;
//           break;
//         }

//         // dynamic route check
//         if (routeSegement[1] == ":") {
//           continue;
//         }

//         if (routeSegement !== urlSegment) {
//           urlSegments.unshift(urlSegment);
//           isRouteMatch = false;
//           break;
//         }
//       }
//     }
//     if (!isRouteMatch) continue;

//     if (isSplatMatch) {
//       // TODO: handle splat match
//       // reuturn the route here
//     }

//     if (urlSegments.length && !route.children?.length) {
//       continue;
//     }

//     let childMatch: ParsedElement = { jsx: null, styles: null, script: null };
//     if (urlSegments.length && route.children?.length) {
//       childMatch = await parseRoute(
//         urlSegments.join(""),
//         route.children,
//         vite,
//         dir
//       );
//       if (!childMatch.jsx) continue;
//     }

//     const loadModule = async (filePath: string) => {
//       const absPath = path.join(dir, filePath);
//       const module = await vite.ssrLoadModule(absPath);
//       const styleModules = componentsModules(absPath, vite);
//       return { module, styleModules };
//     };

//     let styles = "";
//     let element: Record<string, any> = { default: null };
//     const moduleImport: Imports["module"] = {
//       element: null,
//       layout: null,
//       error: null,
//       loading: null
//     };
//     if (route.module && !childMatch.jsx) {
//       const { module, styleModules } = await loadModule(route.module);
//       element = module;
//       // collect css
//       styles += collectCss(styleModules);
//       moduleImport.element = route.module;
//     }

//     let layout = element.layout;
//     if (route.layout) {
//       const { module, styleModules } = await loadModule(route.layout);
//       layout = module.default;
//       styles += collectCss(styleModules);
//     } else if (layout) {
//       moduleImport.layout = route.module;
//     }

//     let error = element.error;
//     if (route.error) {
//       const { module, styleModules } = await loadModule(route.error);
//       error = module.default;
//       styles += collectCss(styleModules);
//     } else if (error) {
//       moduleImport.error = route.module;
//     }

//     let loading = element.loading;
//     if (route.loading) {
//       const { module, styleModules } = await loadModule(route.loading);
//       loading = module.default;
//       styles += collectCss(styleModules);
//     } else if (loading) {
//       moduleImport.loading = route.module;
//     }

//     const jsx = React.createElement(
//       StrictMode,
//       null,
//       React.createElement(
//         Loader,
//         { type: "layout", Component: layout },
//         React.createElement(
//           Loader,
//           { type: "error", Component: error },
//           React.createElement(
//             Loader,
//             { type: "loading", Component: loading },
//             childMatch.jsx
//               ? childMatch.jsx
//               : React.createElement(Loader, {
//                   type: "component",
//                   Component: element.default
//                 })
//           )
//         )
//       )
//     );

//     // load script
//     const scriptImports = {
//       child: childMatch.script,
//       module: moduleImport,
//       layout: route.layout,
//       error: route.error,
//       loading: route.loading
//     };
//     const script = generateScripts(scriptImports, dir);
//     return { jsx, styles, script };
//   }

//   return { jsx: null, styles: null, script: null };
// };
