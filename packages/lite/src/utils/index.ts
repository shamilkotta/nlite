import React from 'react';
import Loader from '../loader';

export function findMatchingRoute(
  url: string,
  routeList: Route[]
): React.ReactElement | null {
  const cleanUrl = url === '/' ? url : url.replace(/\/+$/, '');
  const urlSegments = cleanUrl
    .split('/')
    .filter((_, ind) => ind !== 0)
    .map((segment) => `/${segment}`);

  for (const route of routeList) {
    const routePath =
      route.path === '/'
        ? route.path
        : '/' + route.path.replace(/^\/*(.*?)\/*$/, '$1');
    const routeSegments = routePath
      .split('/')
      .filter((_, ind) => ind !== 0)
      .map((segment) => `/${segment}`);

    let isRouteMatch = true;
    let isSplatMatch = false;
    for (let i = 0; i < routeSegments.length; i++) {
      const routeSegement = routeSegments[i];
      const urlSegment = urlSegments.shift();

      console.log({ urlSegment, routeSegement });

      if (!urlSegment) {
        isRouteMatch = false;
        break;
      }

      // splat match
      if (routeSegement === '/*') {
        isSplatMatch = true;
        isRouteMatch = true;
        break;
      }

      // dynamic route check
      if (routeSegement[1] == ':') {
        continue;
      }

      if (routeSegement == '/$') {
        urlSegments.unshift(urlSegment);
        continue;
      }

      if (routeSegement !== urlSegment) {
        urlSegments.unshift(urlSegment);
        isRouteMatch = false;
        break;
      }
    }

    if (!isRouteMatch) continue;

    if (isSplatMatch) {
      // TODO: handle splat match
      // reuturn the route here
    }

    if (urlSegments.length && !route.children?.length) {
      continue;
    }

    let childMatch: React.ReactElement | null = null;
    if (urlSegments.length && route.children?.length) {
      childMatch = findMatchingRoute(urlSegments.join(''), route.children);
      if (!childMatch) continue;
    }

    // TODO: handle global layout, error
    return React.createElement(
      Loader,
      { type: 'layout', Component: route.layout },
      React.createElement(
        Loader,
        { type: 'error', Component: route.error },
        React.createElement(
          Loader,
          { type: 'loading', Component: route.loading },
          childMatch
            ? childMatch
            : React.createElement(Loader, {
                type: 'component',
                Component: route.component
              })
        )
      )
    );
  }

  return null;
}
