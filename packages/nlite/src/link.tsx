"use client";

import { forwardRef } from "react";
import type { MouseEvent, AnchorHTMLAttributes } from "react";

import { useRouter } from "./navigation.js";

export interface LinkProps
  extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  href: string;
  replace?: boolean;
  scroll?: boolean;
  prefetch?: boolean;
}

const Link = forwardRef<HTMLAnchorElement, LinkProps>(function Link(
  {
    href,
    onClick,
    onMouseEnter,
    onFocus,
    onTouchStart,
    replace,
    scroll,
    prefetch = true,
    target,
    download,
    rel,
    ...props
  },
  ref
) {
  const router = useRouter();

  function warmRoute() {
    if (!prefetch) {
      return;
    }

    void router.prefetch(href);
  }

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
      ref={ref}
      download={download}
      href={href}
      rel={rel}
      target={target}
      onClick={handleClick}
      onFocus={(event) => {
        onFocus?.(event);
        warmRoute();
      }}
      onMouseEnter={(event) => {
        onMouseEnter?.(event);
        warmRoute();
      }}
      onTouchStart={(event) => {
        onTouchStart?.(event);
        warmRoute();
      }}
    />
  );
});

export default Link;

function shouldIgnoreClick(event: MouseEvent<HTMLAnchorElement>) {
  return (
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  );
}
