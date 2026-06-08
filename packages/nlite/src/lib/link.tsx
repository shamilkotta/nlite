"use client";

import { forwardRef, useEffect, useRef } from "react";
import type { AnchorHTMLAttributes, ForwardedRef, MouseEvent, MutableRefObject } from "react";

import { useRouter } from "./navigation/client.js";

export type LinkPrefetch = boolean | "hover";

export interface LinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  href: string;
  replace?: boolean;
  scroll?: boolean;
  prefetch?: LinkPrefetch;
}

type LinkPrefetchMode = "default" | "disabled" | "hover";

const Link = forwardRef<HTMLAnchorElement, LinkProps>(function Link(
  {
    href,
    onClick,
    onMouseEnter,
    onFocus,
    onTouchStart,
    replace,
    scroll,
    prefetch,
    target,
    download,
    rel,
    ...props
  },
  ref,
) {
  const router = useRouter();
  const anchorRef = useRef<HTMLAnchorElement | null>(null);
  const prefetchMode = resolvePrefetchMode(prefetch);
  const skipPrefetch = shouldSkipPrefetch({ href, target, download, rel });

  function warmRoute() {
    if (prefetchMode === "disabled" || skipPrefetch) {
      return;
    }

    void router.prefetch(href);
  }

  useEffect(() => {
    if (!import.meta.env.PROD || prefetchMode !== "default" || skipPrefetch) {
      return;
    }

    const element = anchorRef.current;
    if (!element) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            void router.prefetch(href);
            observer.disconnect();
          }
        }
      },
      { rootMargin: "0px" },
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [href, prefetchMode, router, skipPrefetch]);

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);

    if (
      event.defaultPrevented ||
      shouldIgnoreClick(event) ||
      target === "_blank" ||
      target === "_parent" ||
      target === "_top" ||
      download !== undefined ||
      rel?.includes("external")
    ) {
      return;
    }

    event.preventDefault();

    if (replace) {
      router.replace(href, { scroll });
      return;
    }

    router.push(href, { scroll });
  }

  return (
    <a
      {...props}
      ref={setAnchorRef(ref, anchorRef)}
      download={download}
      href={href}
      rel={rel}
      target={target}
      onClick={handleClick}
      onFocus={(event) => {
        onFocus?.(event);
        if (prefetchMode === "hover") {
          warmRoute();
        }
      }}
      onMouseEnter={(event) => {
        onMouseEnter?.(event);
        if (prefetchMode === "hover") {
          warmRoute();
        }
      }}
      onTouchStart={(event) => {
        onTouchStart?.(event);
        if (prefetchMode === "hover") {
          warmRoute();
        }
      }}
    />
  );
});

export default Link;

function resolvePrefetchMode(prefetch: LinkPrefetch | undefined): LinkPrefetchMode {
  if (prefetch === false) {
    return "disabled";
  }

  if (prefetch === "hover") {
    return "hover";
  }

  return "default";
}

function shouldSkipPrefetch(props: {
  href: string;
  target?: string;
  download?: unknown;
  rel?: string;
}) {
  if (
    props.target === "_blank" ||
    props.target === "_parent" ||
    props.target === "_top" ||
    props.download !== undefined ||
    props.rel?.includes("external")
  ) {
    return true;
  }

  if (typeof window === "undefined") {
    return false;
  }

  try {
    const url = new URL(props.href, window.location.href);
    return url.origin !== window.location.origin;
  } catch {
    return true;
  }
}

function setAnchorRef(
  forwardedRef: ForwardedRef<HTMLAnchorElement>,
  localRef: MutableRefObject<HTMLAnchorElement | null>,
) {
  return (node: HTMLAnchorElement | null) => {
    localRef.current = node;

    if (typeof forwardedRef === "function") {
      forwardedRef(node);
      return;
    }

    if (forwardedRef) {
      forwardedRef.current = node;
    }
  };
}

function shouldIgnoreClick(event: MouseEvent<HTMLAnchorElement>) {
  return event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
}
