import React, { type ReactNode } from "react";

import type { RouteMetadata, RouteMetadataIcon, RouteMetadataLink } from "../../types.js";

export function createHeadNodes(metadata: RouteMetadata, headExtras?: ReactNode): ReactNode[] {
  const headNodes: ReactNode[] = [
    React.createElement("meta", { key: "charset", charSet: "utf-8" }),
    React.createElement("meta", {
      key: "viewport",
      name: "viewport",
      content: "width=device-width, initial-scale=1",
    }),
    React.createElement("title", { key: "title" }, metadata.title),
  ];

  pushNamedMeta(headNodes, "description", metadata.description);
  pushNamedMeta(headNodes, "application-name", metadata.applicationName);
  pushNamedMeta(headNodes, "generator", metadata.generator);
  pushNamedMeta(headNodes, "keywords", metadata.keywords);
  pushNamedMeta(headNodes, "referrer", metadata.referrer);
  pushNamedMeta(headNodes, "creator", metadata.creator);
  pushNamedMeta(headNodes, "publisher", metadata.publisher);
  pushNamedMeta(headNodes, "robots", metadata.robots);
  pushNamedMeta(headNodes, "googlebot", metadata.googleBot);
  pushNamedMeta(headNodes, "abstract", metadata.abstract);
  pushNamedMeta(headNodes, "category", metadata.category);
  pushNamedMeta(headNodes, "classification", metadata.classification);
  pushNamedMeta(headNodes, "format-detection", metadata.formatDetection);
  pushNamedMeta(headNodes, "apple-itunes-app", metadata.itunes);

  pushAuthors(headNodes, metadata);
  pushAlternates(headNodes, metadata);
  pushRelatedLinks(headNodes, metadata);
  pushIcons(headNodes, metadata);
  pushOpenGraph(headNodes, metadata);
  pushTwitter(headNodes, metadata);
  pushSocialMeta(headNodes, metadata);
  pushAppleWebApp(headNodes, metadata);

  for (const link of metadata.links ?? []) {
    headNodes.push(createResourceLink(link));
  }

  for (const entry of metadata.other ?? []) {
    headNodes.push(
      createNamedMeta(`other:${entry.name}:${entry.content}`, entry.name, entry.content),
    );
  }

  if (headExtras) {
    headNodes.push(headExtras);
  }

  return headNodes;
}

function pushAuthors(headNodes: ReactNode[], metadata: RouteMetadata) {
  for (const author of metadata.authors ?? []) {
    if (author.name) {
      headNodes.push(createNamedMeta(`author-name:${author.name}`, "author", author.name));
    }

    if (author.url) {
      headNodes.push(
        React.createElement("link", {
          key: `author-url:${author.url}`,
          rel: "author",
          href: author.url,
        }),
      );
    }
  }
}

function pushAlternates(headNodes: ReactNode[], metadata: RouteMetadata) {
  if (metadata.canonical) {
    headNodes.push(
      React.createElement("link", {
        key: "canonical",
        rel: "canonical",
        href: metadata.canonical,
      }),
    );
  }

  for (const alternate of metadata.languages ?? []) {
    headNodes.push(
      React.createElement("link", {
        key: `alternate-lang:${alternate.hrefLang}:${alternate.href}`,
        rel: "alternate",
        hrefLang: alternate.hrefLang,
        href: alternate.href,
      }),
    );
  }

  for (const alternate of metadata.mediaAlternates ?? []) {
    headNodes.push(
      React.createElement("link", {
        key: `alternate-media:${alternate.media}:${alternate.href}`,
        rel: "alternate",
        media: alternate.media,
        href: alternate.href,
      }),
    );
  }

  for (const alternate of metadata.typeAlternates ?? []) {
    headNodes.push(
      React.createElement("link", {
        key: `alternate-type:${alternate.type}:${alternate.href}`,
        rel: "alternate",
        type: alternate.type,
        href: alternate.href,
      }),
    );
  }
}

function pushRelatedLinks(headNodes: ReactNode[], metadata: RouteMetadata) {
  pushHrefLinks(headNodes, "archives", metadata.archives);
  pushHrefLinks(headNodes, "assets", metadata.assets);
  pushHrefLinks(headNodes, "bookmarks", metadata.bookmarks);

  if (metadata.pagination?.previous) {
    headNodes.push(
      React.createElement("link", {
        key: "pagination-prev",
        rel: "prev",
        href: metadata.pagination.previous,
      }),
    );
  }

  if (metadata.pagination?.next) {
    headNodes.push(
      React.createElement("link", {
        key: "pagination-next",
        rel: "next",
        href: metadata.pagination.next,
      }),
    );
  }

  if (metadata.manifest) {
    headNodes.push(
      React.createElement("link", {
        key: "manifest",
        rel: "manifest",
        href: metadata.manifest,
      }),
    );
  }
}

function pushIcons(headNodes: ReactNode[], metadata: RouteMetadata) {
  pushIconLinks(headNodes, "icon", metadata.icons?.icon);
  pushIconLinks(headNodes, "shortcut icon", metadata.icons?.shortcut);
  pushIconLinks(headNodes, "apple-touch-icon", metadata.icons?.apple);

  for (const icon of metadata.icons?.other ?? []) {
    headNodes.push(createIconLink(icon.rel ?? "icon", icon));
  }

  if (!metadata.icons?.icon?.length && !metadata.icons?.shortcut?.length) {
    headNodes.push(
      React.createElement("link", {
        key: "favicon",
        rel: "icon",
        href: "/favicon.ico",
        sizes: "any",
      }),
    );
  }
}

function pushOpenGraph(headNodes: ReactNode[], metadata: RouteMetadata) {
  pushPropertyMeta(headNodes, "og:title", metadata.openGraph?.title);
  pushPropertyMeta(headNodes, "og:description", metadata.openGraph?.description);
  pushPropertyMeta(headNodes, "og:url", metadata.openGraph?.url);
  pushPropertyMeta(headNodes, "og:site_name", metadata.openGraph?.siteName);
  pushPropertyMeta(headNodes, "og:locale", metadata.openGraph?.locale);
  pushPropertyMeta(headNodes, "og:type", metadata.openGraph?.type);

  for (const image of metadata.openGraph?.images ?? []) {
    pushPropertyMeta(headNodes, `og:image:${image.url}`, image.url, "og:image");
    pushPropertyMeta(headNodes, `og:image:alt:${image.url}`, image.alt, "og:image:alt");
    pushPropertyMeta(
      headNodes,
      `og:image:width:${image.url}`,
      image.width == null ? undefined : String(image.width),
      "og:image:width",
    );
    pushPropertyMeta(
      headNodes,
      `og:image:height:${image.url}`,
      image.height == null ? undefined : String(image.height),
      "og:image:height",
    );
    pushPropertyMeta(headNodes, `og:image:type:${image.url}`, image.type, "og:image:type");
  }
}

function pushTwitter(headNodes: ReactNode[], metadata: RouteMetadata) {
  pushNamedMeta(headNodes, "twitter:card", metadata.twitter?.card);
  pushNamedMeta(headNodes, "twitter:title", metadata.twitter?.title);
  pushNamedMeta(headNodes, "twitter:description", metadata.twitter?.description);
  pushNamedMeta(headNodes, "twitter:site", metadata.twitter?.site);
  pushNamedMeta(headNodes, "twitter:creator", metadata.twitter?.creator);

  for (const image of metadata.twitter?.images ?? []) {
    pushNamedMeta(headNodes, "twitter:image", image.url, `twitter:image:${image.url}`);
    pushNamedMeta(headNodes, "twitter:image:alt", image.alt, `twitter:image:alt:${image.url}`);
  }
}

function pushSocialMeta(headNodes: ReactNode[], metadata: RouteMetadata) {
  pushPropertyMeta(headNodes, "fb:app_id", metadata.facebook?.appId);

  for (const admin of metadata.facebook?.admins ?? []) {
    pushPropertyMeta(headNodes, `fb:admins:${admin}`, admin, "fb:admins");
  }

  if (metadata.pinterest?.richPin != null) {
    pushNamedMeta(headNodes, "pinterest-rich-pin", String(metadata.pinterest.richPin));
  }

  for (const entry of metadata.verification ?? []) {
    headNodes.push(
      createNamedMeta(`verification:${entry.name}:${entry.content}`, entry.name, entry.content),
    );
  }
}

function pushAppleWebApp(headNodes: ReactNode[], metadata: RouteMetadata) {
  if (metadata.appleWebApp?.capable != null) {
    pushNamedMeta(
      headNodes,
      "apple-mobile-web-app-capable",
      metadata.appleWebApp.capable ? "yes" : "no",
    );
  }

  pushNamedMeta(headNodes, "apple-mobile-web-app-title", metadata.appleWebApp?.title);
  pushNamedMeta(
    headNodes,
    "apple-mobile-web-app-status-bar-style",
    metadata.appleWebApp?.statusBarStyle,
  );

  for (const image of metadata.appleWebApp?.startupImage ?? []) {
    headNodes.push(
      React.createElement("link", {
        key: `apple-touch-startup-image:${image.url}:${image.media ?? ""}`,
        rel: "apple-touch-startup-image",
        href: image.url,
        ...(image.media ? { media: image.media } : null),
      }),
    );
  }
}

function pushNamedMeta(
  headNodes: ReactNode[],
  name: string,
  content: string | undefined,
  key = name,
) {
  if (!content) {
    return;
  }

  headNodes.push(createNamedMeta(key, name, content));
}

function pushPropertyMeta(
  headNodes: ReactNode[],
  key: string,
  content: string | undefined,
  property = key,
) {
  if (!content) {
    return;
  }

  headNodes.push(
    React.createElement("meta", {
      key,
      property,
      content,
    }),
  );
}

function createNamedMeta(key: string, name: string, content: string) {
  return React.createElement("meta", {
    key,
    name,
    content,
  });
}

function pushHrefLinks(headNodes: ReactNode[], rel: string, hrefs: string[] | undefined) {
  for (const href of hrefs ?? []) {
    headNodes.push(
      React.createElement("link", {
        key: `${rel}:${href}`,
        rel,
        href,
      }),
    );
  }
}

function pushIconLinks(
  headNodes: ReactNode[],
  rel: string,
  icons: RouteMetadataIcon[] | undefined,
) {
  for (const icon of icons ?? []) {
    headNodes.push(createIconLink(rel, icon));
  }
}

function createIconLink(rel: string, icon: RouteMetadataIcon) {
  return React.createElement("link", {
    key: `${rel}:${icon.url}:${icon.sizes ?? ""}:${icon.media ?? ""}`,
    rel,
    href: icon.url,
    ...(icon.sizes ? { sizes: icon.sizes } : null),
    ...(icon.type ? { type: icon.type } : null),
    ...(icon.media ? { media: icon.media } : null),
    ...(icon.color ? { color: icon.color } : null),
    ...(icon.fetchPriority ? { fetchPriority: icon.fetchPriority } : null),
  });
}

function createResourceLink(link: RouteMetadataLink) {
  return React.createElement("link", {
    key: `link:${link.rel}:${link.href}:${link.as ?? ""}:${link.media ?? ""}:${link.imageSrcSet ?? ""}`,
    rel: link.rel,
    href: link.href,
    ...(link.as ? { as: link.as } : null),
    ...(link.type ? { type: link.type } : null),
    ...(link.crossOrigin != null ? { crossOrigin: link.crossOrigin } : null),
    ...(link.integrity ? { integrity: link.integrity } : null),
    ...(link.media ? { media: link.media } : null),
    ...(link.sizes ? { sizes: link.sizes } : null),
    ...(link.imageSrcSet ? { imageSrcSet: link.imageSrcSet } : null),
    ...(link.imageSizes ? { imageSizes: link.imageSizes } : null),
    ...(link.hrefLang ? { hrefLang: link.hrefLang } : null),
    ...(link.referrerPolicy ? { referrerPolicy: link.referrerPolicy } : null),
    ...(link.fetchPriority ? { fetchPriority: link.fetchPriority } : null),
    ...(link.title ? { title: link.title } : null),
  });
}
