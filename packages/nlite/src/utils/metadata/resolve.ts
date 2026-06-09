import { NliteRouteRecord, RouteMetadata, RouteParams } from "../../types.js";
import type { Metadata, MetadataModule, MetadataTitle } from "./types.js";

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
    };
  }

  if (segment.icons) {
    merged.icons = segment.icons;
  } else if (parent.icons) {
    merged.icons = parent.icons;
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
  const title = resolveTitleValue(metadata.title);
  const description = metadata.description;
  const keywords = normalizeKeywords(metadata.keywords);
  const robots = normalizeRobots(metadata.robots);
  const canonical = resolveUrl(metadata.alternates?.canonical, metadataBase);
  const openGraph = metadata.openGraph
    ? {
        title: metadata.openGraph.title,
        description: metadata.openGraph.description,
        url: resolveUrl(metadata.openGraph.url, metadataBase),
        siteName: metadata.openGraph.siteName,
        images: normalizeImages(metadata.openGraph.images, metadataBase),
      }
    : undefined;
  const twitter = metadata.twitter
    ? {
        card: metadata.twitter.card,
        title: metadata.twitter.title,
        description: metadata.twitter.description,
        images: normalizeImages(metadata.twitter.images, metadataBase),
      }
    : undefined;
  const icons = metadata.icons
    ? {
        icon: normalizeIcons(metadata.icons.icon, metadataBase),
        apple: normalizeIcons(metadata.icons.apple, metadataBase),
      }
    : undefined;

  return {
    title,
    description,
    keywords,
    robots,
    canonical,
    openGraph,
    twitter,
    icons,
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
    return robots;
  }

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

  return values.length > 0 ? values.join(", ") : undefined;
}

function normalizeImages(
  images: MetadataOpenGraph["images"] | MetadataTwitter["images"] | undefined,
  metadataBase?: string,
) {
  if (!images) {
    return;
  }

  const list = Array.isArray(images) ? images : [images];
  const normalized = list
    .map((image) => {
      if (typeof image === "string" || image instanceof URL) {
        return resolveUrl(image, metadataBase);
      }

      return resolveUrl(image.url, metadataBase);
    })
    .filter((image): image is string => Boolean(image));

  return normalized.length > 0 ? normalized : undefined;
}

function normalizeIcons(
  icons: string | URL | Array<string | URL> | undefined,
  metadataBase?: string,
) {
  if (!icons) {
    return;
  }

  const list = Array.isArray(icons) ? icons : [icons];
  const normalized = list
    .map((icon) => resolveUrl(icon, metadataBase))
    .filter((icon): icon is string => Boolean(icon));

  return normalized.length > 0 ? normalized : undefined;
}

function resolveUrl(value: string | URL | undefined, metadataBase?: string) {
  if (!value) {
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

type MetadataOpenGraph = NonNullable<Metadata["openGraph"]>;
type MetadataTwitter = NonNullable<Metadata["twitter"]>;
