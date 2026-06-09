import React, { type PropsWithChildren, type ReactNode } from "react";

import { styles, scripts } from "virtual:nlite/assets";

import type { RouteMetadata } from "../../types.js";

export function Document({
  children,
  metadata,
  headExtras,
}: PropsWithChildren<{ metadata: RouteMetadata; headExtras?: ReactNode }>) {
  const headNodes: ReactNode[] = [
    scripts ? React.createElement("script", { key: "bootstrap", src: scripts }) : null,
    styles ? React.createElement("link", { key: "styles", rel: "stylesheet", href: styles }) : null,
    React.createElement("meta", { key: "charset", charSet: "utf-8" }),
    React.createElement("meta", {
      key: "viewport",
      name: "viewport",
      content: "width=device-width, initial-scale=1",
    }),
    React.createElement("title", { key: "title" }, metadata.title),
  ];

  if (metadata.description) {
    headNodes.push(
      React.createElement("meta", {
        key: "description",
        name: "description",
        content: metadata.description,
      }),
    );
  }

  if (metadata.keywords) {
    headNodes.push(
      React.createElement("meta", {
        key: "keywords",
        name: "keywords",
        content: metadata.keywords,
      }),
    );
  }

  if (metadata.robots) {
    headNodes.push(
      React.createElement("meta", {
        key: "robots",
        name: "robots",
        content: metadata.robots,
      }),
    );
  }

  if (metadata.canonical) {
    headNodes.push(
      React.createElement("link", {
        key: "canonical",
        rel: "canonical",
        href: metadata.canonical,
      }),
    );
  }

  for (const href of metadata.icons?.icon ?? []) {
    headNodes.push(
      React.createElement("link", {
        key: `icon:${href}`,
        rel: "icon",
        href,
      }),
    );
  }

  for (const href of metadata.icons?.apple ?? []) {
    headNodes.push(
      React.createElement("link", {
        key: `apple:${href}`,
        rel: "apple-touch-icon",
        href,
      }),
    );
  }

  if (!metadata.icons?.icon?.length) {
    headNodes.push(
      React.createElement("link", {
        key: "favicon",
        rel: "icon",
        href: "/favicon.ico",
        sizes: "any",
      }),
    );
  }

  if (metadata.openGraph?.title) {
    headNodes.push(
      React.createElement("meta", {
        key: "og:title",
        property: "og:title",
        content: metadata.openGraph.title,
      }),
    );
  }

  if (metadata.openGraph?.description) {
    headNodes.push(
      React.createElement("meta", {
        key: "og:description",
        property: "og:description",
        content: metadata.openGraph.description,
      }),
    );
  }

  if (metadata.openGraph?.url) {
    headNodes.push(
      React.createElement("meta", {
        key: "og:url",
        property: "og:url",
        content: metadata.openGraph.url,
      }),
    );
  }

  if (metadata.openGraph?.siteName) {
    headNodes.push(
      React.createElement("meta", {
        key: "og:site_name",
        property: "og:site_name",
        content: metadata.openGraph.siteName,
      }),
    );
  }

  for (const image of metadata.openGraph?.images ?? []) {
    headNodes.push(
      React.createElement("meta", {
        key: `og:image:${image}`,
        property: "og:image",
        content: image,
      }),
    );
  }

  if (metadata.twitter?.card) {
    headNodes.push(
      React.createElement("meta", {
        key: "twitter:card",
        name: "twitter:card",
        content: metadata.twitter.card,
      }),
    );
  }

  if (metadata.twitter?.title) {
    headNodes.push(
      React.createElement("meta", {
        key: "twitter:title",
        name: "twitter:title",
        content: metadata.twitter.title,
      }),
    );
  }

  if (metadata.twitter?.description) {
    headNodes.push(
      React.createElement("meta", {
        key: "twitter:description",
        name: "twitter:description",
        content: metadata.twitter.description,
      }),
    );
  }

  for (const image of metadata.twitter?.images ?? []) {
    headNodes.push(
      React.createElement("meta", {
        key: `twitter:image:${image}`,
        name: "twitter:image",
        content: image,
      }),
    );
  }

  if (headExtras) {
    headNodes.push(headExtras);
  }

  return React.createElement(
    "html",
    { lang: "en" },
    React.createElement("head", null, ...headNodes),
    React.createElement("body", null, children),
  );
}
