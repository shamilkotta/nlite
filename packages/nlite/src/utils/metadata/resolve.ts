import type { NliteRouteRecord, RouteMetadata, RouteParams } from "../../types.js";
import type {
  Metadata,
  MetadataAuthor,
  MetadataIcon,
  MetadataIcons,
  MetadataLink,
  MetadataModule,
  MetadataOpenGraph,
  MetadataRobots,
  MetadataTitle,
  MetadataTwitter,
} from "./types.js";

export async function resolveRouteMetadata(
  route: NliteRouteRecord,
  params: RouteParams,
  searchParams: URLSearchParams,
  options: { includePage?: boolean } = {},
): Promise<RouteMetadata> {
  const includePage = options.includePage ?? true;
  const modules: MetadataModule[] = [];

  for (const segment of route.tree) {
    if (segment.layout) {
      modules.push(segment.layout);
    }
  }

  if (includePage) {
    modules.push(route.page);
  }

  const resolvedParams = Promise.resolve(params);
  const resolvedSearchParams = Promise.resolve(searchParams);
  let accumulated: Metadata = {};
  let titleTemplate: string | null = null;

  for (let index = 0; index < modules.length; index += 1) {
    const module = modules[index]!;
    const segmentMetadata = await loadSegmentMetadata(module, {
      params: resolvedParams,
      searchParams: resolvedSearchParams,
      parent: Promise.resolve(structuredClone(accumulated)),
    });

    if (!segmentMetadata) {
      continue;
    }

    accumulated = mergeMetadata(accumulated, segmentMetadata, titleTemplate);

    if (index < modules.length - 1) {
      titleTemplate = getTitleTemplate(segmentMetadata.title) ?? titleTemplate;
    }
  }

  return toRouteMetadata(accumulated);
}

async function loadSegmentMetadata(
  module: MetadataModule,
  context: {
    params: Promise<RouteParams>;
    searchParams: Promise<URLSearchParams>;
    parent: Promise<Metadata>;
  },
): Promise<Metadata | undefined> {
  if (module.generateMetadata) {
    return module.generateMetadata(
      {
        params: context.params,
        searchParams: context.searchParams,
      },
      context.parent,
    );
  }

  if (module.metadata) {
    return module.metadata;
  }

  return;
}

function mergeMetadata(
  parent: Metadata,
  segment: Metadata,
  titleTemplate: string | null,
): Metadata {
  const merged: Metadata = { ...parent, ...segment };

  if (segment.title !== undefined) {
    merged.title = resolveTitle(segment.title, titleTemplate);
  } else if (parent.title !== undefined) {
    merged.title = parent.title;
  }

  if (segment.metadataBase !== undefined) {
    merged.metadataBase = segment.metadataBase;
  } else if (parent.metadataBase !== undefined) {
    merged.metadataBase = parent.metadataBase;
  }

  if (parent.openGraph || segment.openGraph) {
    merged.openGraph = {
      ...parent.openGraph,
      ...segment.openGraph,
    };
  }

  if (parent.twitter || segment.twitter) {
    merged.twitter = {
      ...parent.twitter,
      ...segment.twitter,
    };
  }

  if (parent.alternates || segment.alternates) {
    merged.alternates = {
      ...parent.alternates,
      ...segment.alternates,
      languages: {
        ...parent.alternates?.languages,
        ...segment.alternates?.languages,
      },
      media: {
        ...parent.alternates?.media,
        ...segment.alternates?.media,
      },
      types: {
        ...parent.alternates?.types,
        ...segment.alternates?.types,
      },
    };
  }

  if (segment.icons !== undefined) {
    merged.icons = segment.icons;
  } else if (parent.icons !== undefined) {
    merged.icons = parent.icons;
  }

  if (parent.verification || segment.verification) {
    merged.verification = {
      ...parent.verification,
      ...segment.verification,
      other: {
        ...parent.verification?.other,
        ...segment.verification?.other,
      },
    };
  }

  if (parent.appleWebApp || segment.appleWebApp) {
    if (typeof segment.appleWebApp === "boolean" || typeof parent.appleWebApp === "boolean") {
      merged.appleWebApp = segment.appleWebApp ?? parent.appleWebApp;
    } else {
      merged.appleWebApp = {
        ...parent.appleWebApp,
        ...segment.appleWebApp,
      };
    }
  }

  if (parent.formatDetection || segment.formatDetection) {
    merged.formatDetection = {
      ...parent.formatDetection,
      ...segment.formatDetection,
    };
  }

  if (parent.facebook || segment.facebook) {
    merged.facebook = {
      ...parent.facebook,
      ...segment.facebook,
    };
  }

  if (parent.pinterest || segment.pinterest) {
    merged.pinterest = {
      ...parent.pinterest,
      ...segment.pinterest,
    };
  }

  if (parent.pagination || segment.pagination) {
    merged.pagination = {
      ...parent.pagination,
      ...segment.pagination,
    };
  }

  if (parent.other || segment.other) {
    merged.other = {
      ...parent.other,
      ...segment.other,
    };
  }

  if (segment.links !== undefined) {
    merged.links = concatField(parent.links, segment.links);
  } else if (parent.links !== undefined) {
    merged.links = parent.links;
  }

  return merged;
}

function getTitleTemplate(title: MetadataTitle | undefined) {
  if (!title || typeof title === "string") {
    return null;
  }

  return title.template ?? null;
}

function resolveTitle(title: MetadataTitle, titleTemplate: string | null): string {
  if (typeof title === "string") {
    return applyTitleTemplate(titleTemplate, title);
  }

  if (title.absolute) {
    return title.absolute;
  }

  if (title.default) {
    return applyTitleTemplate(titleTemplate, title.default);
  }

  return "";
}

function applyTitleTemplate(template: string | null, title: string) {
  return template ? template.replace(/%s/g, title) : title;
}

function toRouteMetadata(metadata: Metadata): RouteMetadata {
  const metadataBase = metadata.metadataBase ? String(metadata.metadataBase) : undefined;
  const robots = normalizeRobots(metadata.robots);

  return {
    title: resolveTitleValue(metadata.title),
    description: metadata.description,
    applicationName: metadata.applicationName,
    authors: normalizeAuthors(metadata.authors, metadataBase),
    generator: metadata.generator,
    keywords: normalizeKeywords(metadata.keywords),
    referrer: metadata.referrer,
    creator: metadata.creator,
    publisher: metadata.publisher,
    robots: robots?.basic,
    googleBot: robots?.googleBot,
    abstract: metadata.abstract,
    category: metadata.category,
    classification: metadata.classification,
    canonical: resolveUrl(metadata.alternates?.canonical, metadataBase),
    languages: normalizeAlternateMap(metadata.alternates?.languages, metadataBase, "hrefLang"),
    mediaAlternates: normalizeAlternateMap(metadata.alternates?.media, metadataBase, "media"),
    typeAlternates: normalizeAlternateMap(metadata.alternates?.types, metadataBase, "type"),
    openGraph: normalizeOpenGraph(metadata.openGraph, metadataBase),
    twitter: normalizeTwitter(metadata.twitter, metadataBase),
    facebook: normalizeFacebook(metadata.facebook),
    pinterest: metadata.pinterest ? { richPin: metadata.pinterest.richPin } : undefined,
    icons: normalizeIcons(metadata.icons, metadataBase),
    manifest: resolveUrl(metadata.manifest, metadataBase),
    verification: normalizeVerification(metadata.verification),
    appleWebApp: normalizeAppleWebApp(metadata.appleWebApp, metadataBase),
    formatDetection: normalizeFormatDetection(metadata.formatDetection),
    itunes: normalizeItunes(metadata.itunes),
    archives: normalizeStringList(metadata.archives, metadataBase),
    assets: normalizeStringList(metadata.assets, metadataBase),
    bookmarks: normalizeStringList(metadata.bookmarks, metadataBase),
    pagination: metadata.pagination
      ? {
          previous: resolveUrl(metadata.pagination.previous, metadataBase),
          next: resolveUrl(metadata.pagination.next, metadataBase),
        }
      : undefined,
    links: normalizeLinks(metadata.links, metadataBase),
    other: normalizeOther(metadata.other),
  };
}

function resolveTitleValue(title: MetadataTitle | undefined) {
  if (!title) {
    return "";
  }

  if (typeof title === "string") {
    return title;
  }

  return title.absolute || title.default || "";
}

function normalizeKeywords(keywords: string | string[] | undefined) {
  if (!keywords) {
    return;
  }

  return Array.isArray(keywords) ? keywords.join(", ") : keywords;
}

function normalizeRobots(robots: Metadata["robots"]) {
  if (!robots) {
    return;
  }

  if (typeof robots === "string") {
    return { basic: robots };
  }

  const basic = robotsObjectToString(robots);
  const googleBot =
    typeof robots.googleBot === "string"
      ? robots.googleBot
      : robots.googleBot
        ? robotsObjectToString(robots.googleBot)
        : undefined;

  return {
    basic: basic || undefined,
    googleBot,
  };
}

function robotsObjectToString(robots: Omit<MetadataRobots, "googleBot">) {
  const values: string[] = [];

  if (robots.index === false) {
    values.push("noindex");
  } else if (robots.index === true) {
    values.push("index");
  }

  if (robots.follow === false) {
    values.push("nofollow");
  } else if (robots.follow === true) {
    values.push("follow");
  }

  if (robots.noarchive) values.push("noarchive");
  if (robots.nosnippet) values.push("nosnippet");
  if (robots.noimageindex) values.push("noimageindex");
  if (robots.nocache) values.push("nocache");
  if (robots.notranslate) values.push("notranslate");
  if (robots.indexifembedded) values.push("indexifembedded");
  if (robots.nositelinkssearchbox) values.push("nositelinkssearchbox");
  if (robots.unavailable_after) values.push(`unavailable_after: ${robots.unavailable_after}`);
  if (robots["max-snippet"] != null) values.push(`max-snippet:${robots["max-snippet"]}`);
  if (robots["max-image-preview"]) values.push(`max-image-preview:${robots["max-image-preview"]}`);
  if (robots["max-video-preview"] != null) {
    values.push(`max-video-preview:${robots["max-video-preview"]}`);
  }

  return values.join(", ");
}

function normalizeAuthors(
  authors: MetadataAuthor | MetadataAuthor[] | undefined,
  metadataBase?: string,
) {
  if (!authors) {
    return;
  }

  const list = Array.isArray(authors) ? authors : [authors];
  const normalized = list.map((author) => ({
    name: author.name,
    url: resolveUrl(author.url, metadataBase),
  }));

  return normalized.length > 0 ? normalized : undefined;
}

function normalizeAlternateMap<TKey extends "hrefLang" | "media" | "type">(
  map: Record<string, string | URL | Array<string | URL>> | undefined,
  metadataBase: string | undefined,
  keyName: TKey,
): Array<{ href: string } & Record<TKey, string>> | undefined {
  if (!map) {
    return;
  }

  const entries: Array<{ href: string } & Record<TKey, string>> = [];

  for (const [key, value] of Object.entries(map)) {
    const values = Array.isArray(value) ? value : [value];
    for (const item of values) {
      const href = resolveUrl(item, metadataBase);
      if (href) {
        entries.push({ [keyName]: key, href } as { href: string } & Record<TKey, string>);
      }
    }
  }

  return entries.length > 0 ? entries : undefined;
}

function normalizeOpenGraph(openGraph: MetadataOpenGraph | undefined, metadataBase?: string) {
  if (!openGraph) {
    return;
  }

  return {
    title: openGraph.title,
    description: openGraph.description,
    url: resolveUrl(openGraph.url, metadataBase),
    siteName: openGraph.siteName,
    locale: openGraph.locale,
    type: openGraph.type,
    images: normalizeImageDescriptors(openGraph.images, metadataBase),
  };
}

function normalizeTwitter(twitter: MetadataTwitter | undefined, metadataBase?: string) {
  if (!twitter) {
    return;
  }

  return {
    card: twitter.card,
    title: twitter.title,
    description: twitter.description,
    site: twitter.site,
    creator: twitter.creator,
    images: normalizeImageDescriptors(twitter.images, metadataBase)?.map((image) => ({
      url: image.url,
      alt: image.alt,
    })),
  };
}

function normalizeFacebook(facebook: Metadata["facebook"]) {
  if (!facebook) {
    return;
  }

  return {
    appId: facebook.appId,
    admins: facebook.admins
      ? Array.isArray(facebook.admins)
        ? facebook.admins
        : [facebook.admins]
      : undefined,
  };
}

function normalizeIcons(
  icons: MetadataIcon | MetadataIcon[] | MetadataIcons | undefined,
  metadataBase?: string,
) {
  if (!icons) {
    return;
  }

  if (typeof icons === "string" || icons instanceof URL || Array.isArray(icons) || "url" in icons) {
    const icon = normalizeIconList(icons as MetadataIcon | MetadataIcon[], metadataBase);
    return icon ? { icon } : undefined;
  }

  const resolved = {
    icon: normalizeIconList(icons.icon, metadataBase),
    shortcut: normalizeIconList(icons.shortcut, metadataBase),
    apple: normalizeIconList(icons.apple, metadataBase),
    other: normalizeIconList(icons.other, metadataBase),
  };

  if (!resolved.icon && !resolved.shortcut && !resolved.apple && !resolved.other) {
    return;
  }

  return resolved;
}

function normalizeIconList(
  icons: MetadataIcon | MetadataIcon[] | undefined,
  metadataBase?: string,
) {
  if (!icons) {
    return;
  }

  const list = Array.isArray(icons) ? icons : [icons];
  const normalized = list
    .map((icon) => {
      if (typeof icon === "string" || icon instanceof URL) {
        const url = resolveUrl(icon, metadataBase);
        return url ? { url } : undefined;
      }

      const url = resolveUrl(icon.url, metadataBase);
      if (!url) {
        return;
      }

      return {
        url,
        sizes: icon.sizes,
        type: icon.type,
        media: icon.media,
        color: icon.color,
        rel: icon.rel,
        fetchPriority: icon.fetchPriority,
      };
    })
    .filter((icon): icon is NonNullable<typeof icon> => Boolean(icon));

  return normalized.length > 0 ? normalized : undefined;
}

function normalizeImageDescriptors(
  images:
    | string
    | URL
    | Array<
        | string
        | URL
        | { url: string | URL; alt?: string; width?: number; height?: number; type?: string }
      >
    | undefined,
  metadataBase?: string,
) {
  if (!images) {
    return;
  }

  const list = Array.isArray(images) ? images : [images];
  const normalized = list
    .map((image) => {
      if (typeof image === "string" || image instanceof URL) {
        const url = resolveUrl(image, metadataBase);
        return url ? { url } : undefined;
      }

      const url = resolveUrl(image.url, metadataBase);
      if (!url) {
        return;
      }

      return {
        url,
        alt: image.alt,
        width: image.width,
        height: image.height,
        type: image.type,
      };
    })
    .filter((image): image is NonNullable<typeof image> => Boolean(image));

  return normalized.length > 0 ? normalized : undefined;
}

function normalizeVerification(verification: Metadata["verification"]) {
  if (!verification) {
    return;
  }

  const entries: Array<{ name: string; content: string }> = [];

  pushVerification(entries, "google-site-verification", verification.google);
  pushVerification(entries, "y_key", verification.yahoo);
  pushVerification(entries, "yandex-verification", verification.yandex);
  pushVerification(entries, "me", verification.me);

  if (verification.other) {
    for (const [name, content] of Object.entries(verification.other)) {
      pushVerification(entries, name, content);
    }
  }

  return entries.length > 0 ? entries : undefined;
}

function pushVerification(
  entries: Array<{ name: string; content: string }>,
  name: string,
  content: string | number | Array<string | number> | undefined,
) {
  if (content == null) {
    return;
  }

  const values = Array.isArray(content) ? content : [content];
  for (const value of values) {
    if (value != null && value !== "") {
      entries.push({ name, content: String(value) });
    }
  }
}

function normalizeAppleWebApp(appleWebApp: Metadata["appleWebApp"], metadataBase?: string) {
  if (appleWebApp == null) {
    return;
  }

  if (appleWebApp === true) {
    return { capable: true };
  }

  if (appleWebApp === false) {
    return { capable: false };
  }

  const startupImage = appleWebApp.startupImage
    ? (Array.isArray(appleWebApp.startupImage)
        ? appleWebApp.startupImage
        : [appleWebApp.startupImage]
      )
        .map((image) => {
          if (typeof image === "string" || image instanceof URL) {
            const url = resolveUrl(image, metadataBase);
            return url ? { url } : undefined;
          }

          const url = resolveUrl(image.url, metadataBase);
          return url ? { url, media: image.media } : undefined;
        })
        .filter((image): image is NonNullable<typeof image> => Boolean(image))
    : undefined;

  return {
    capable: appleWebApp.capable,
    title: appleWebApp.title,
    statusBarStyle: appleWebApp.statusBarStyle,
    startupImage: startupImage?.length ? startupImage : undefined,
  };
}

function normalizeFormatDetection(formatDetection: Metadata["formatDetection"]) {
  if (!formatDetection) {
    return;
  }

  const values: string[] = [];
  for (const [key, enabled] of Object.entries(formatDetection)) {
    if (typeof enabled === "boolean") {
      values.push(`${key}=${enabled ? "yes" : "no"}`);
    }
  }

  return values.length > 0 ? values.join(", ") : undefined;
}

function normalizeItunes(itunes: Metadata["itunes"]) {
  if (!itunes) {
    return;
  }

  const parts = [`app-id=${itunes.appId}`];
  if (itunes.appArgument) {
    parts.push(`app-argument=${itunes.appArgument}`);
  }

  return parts.join(", ");
}

function normalizeStringList(value: string | string[] | undefined, metadataBase?: string) {
  if (!value) {
    return;
  }

  const list = Array.isArray(value) ? value : [value];
  const normalized = list
    .map((item) => resolveUrl(item, metadataBase))
    .filter((item): item is string => Boolean(item));

  return normalized.length > 0 ? normalized : undefined;
}

function normalizeLinks(links: MetadataLink | MetadataLink[] | undefined, metadataBase?: string) {
  if (!links) {
    return;
  }

  const list = Array.isArray(links) ? links : [links];
  const normalized = list
    .map((link) => {
      const href = resolveUrl(link.href, metadataBase);
      if (!href) {
        return;
      }

      return {
        rel: link.rel,
        href,
        as: link.as,
        type: link.type,
        crossOrigin: link.crossOrigin,
        integrity: link.integrity,
        media: link.media,
        sizes: link.sizes,
        imageSrcSet: link.imageSrcSet,
        imageSizes: link.imageSizes,
        hrefLang: link.hrefLang,
        referrerPolicy: link.referrerPolicy,
        fetchPriority: link.fetchPriority,
        title: link.title,
      };
    })
    .filter((link): link is NonNullable<typeof link> => Boolean(link));

  return normalized.length > 0 ? normalized : undefined;
}

function normalizeOther(other: Metadata["other"]) {
  if (!other) {
    return;
  }

  const entries: Array<{ name: string; content: string }> = [];
  for (const [name, content] of Object.entries(other)) {
    pushVerification(entries, name, content);
  }

  return entries.length > 0 ? entries : undefined;
}

function concatField<T>(parent: T | T[] | undefined, segment: T | T[] | undefined) {
  const parentList = parent == null ? [] : Array.isArray(parent) ? parent : [parent];
  const segmentList = segment == null ? [] : Array.isArray(segment) ? segment : [segment];
  return [...parentList, ...segmentList];
}

function resolveUrl(value: string | URL | undefined | null, metadataBase?: string) {
  if (value == null) {
    return;
  }

  const href = String(value);

  if (href.startsWith("http://") || href.startsWith("https://") || href.startsWith("//")) {
    return href;
  }

  if (!metadataBase) {
    return href;
  }

  try {
    return new URL(href, metadataBase).href;
  } catch {
    return href;
  }
}
