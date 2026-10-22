/**
 * Tiny HTML helpers. Fixtures put the values under test in leaf elements with unique `id`s,
 * so a regex lookup is enough and keeps the suite free of a DOM parser dependency.
 */

/** Text content of the first element with `id`, or `undefined` when it is absent. */
export function textById(html: string, id: string) {
  const pattern = new RegExp(`<([a-zA-Z0-9]+)[^>]*\\sid="${escapeRegex(id)}"[^>]*>([\\s\\S]*?)</\\1>`);
  const match = html.match(pattern);
  return match ? toText(match[2]!) : undefined;
}

/** Text content of every element with `id` (a PPR response can contain a fallback and the resumed node). */
export function allTextById(html: string, id: string) {
  const pattern = new RegExp(
    `<([a-zA-Z0-9]+)[^>]*\\sid="${escapeRegex(id)}"[^>]*>([\\s\\S]*?)</\\1>`,
    "g",
  );
  return [...html.matchAll(pattern)].map((match) => toText(match[2]!));
}

export function hasId(html: string, id: string) {
  return new RegExp(`\\sid="${escapeRegex(id)}"`).test(html);
}

/** The document `<title>` set from metadata (React renders exactly one). */
export function titleOf(html: string) {
  const titles = [...html.matchAll(/<title>([\s\S]*?)<\/title>/g)].map((match) => toText(match[1]!));
  return titles.filter(Boolean).at(-1) ?? "";
}

/** `content` of `<meta name|property="...">`. */
export function metaContent(html: string, key: string) {
  for (const match of html.matchAll(/<meta\s[^>]*>/g)) {
    const tag = match[0];
    const name = attr(tag, "name") ?? attr(tag, "property");
    if (name === key) {
      return attr(tag, "content");
    }
  }

  return undefined;
}

/** All `<link>` tags as attribute maps. */
export function links(html: string) {
  return [...html.matchAll(/<link\s[^>]*>/g)].map((match) => {
    const tag = match[0];
    const attrs: Record<string, string> = {};
    for (const pair of tag.matchAll(/([a-zA-Z-:]+)="([^"]*)"/g)) {
      attrs[pair[1]!] = decodeEntities(pair[2]!);
    }
    return attrs;
  });
}

/** HTML with the inlined RSC flight `<script>` chunks removed, i.e. only what React rendered. */
export function withoutFlight(html: string) {
  return html.replace(/<script>window\.__NLITE_(PUSH|CLOSE)_RSC__[\s\S]*?<\/script>/g, "");
}

export function attr(tag: string, name: string) {
  const match = tag.match(new RegExp(`\\s${escapeRegex(name)}="([^"]*)"`));
  return match ? decodeEntities(match[1]!) : undefined;
}

function toText(fragment: string) {
  return decodeEntities(fragment.replace(/<!--[\s\S]*?-->/g, "").replace(/<[^>]+>/g, "")).trim();
}

function decodeEntities(value: string) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
