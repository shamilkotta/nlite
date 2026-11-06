"use client";

import type { PropsWithChildren } from "react";
import Link from "nlite/link";
import { usePathname } from "nlite/navigation";

export function NavLink({ href, children }: PropsWithChildren<{ href: string }>) {
  const pathname = usePathname();

  return (
    <Link href={href} aria-current={pathname === href ? "page" : undefined}>
      {children}
    </Link>
  );
}
