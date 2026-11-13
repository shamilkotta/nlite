import type { Metadata } from "nlite";
import type { PropsWithChildren } from "react";

import { NavLink } from "../components/nav-link";
import "./styles.css";

export const metadata: Metadata = {
  title: { default: "nlite basic", template: "%s · nlite basic" },
  description: "Routing and rendering basics in nlite",
};

export default function RootLayout({ children }: PropsWithChildren) {
  return (
    <div className="wrap">
      <nav className="head">
        <NavLink href="/">Home</NavLink>
        <NavLink href="/about">About</NavLink>
        <NavLink href="/posts">Posts</NavLink>
        <NavLink href="/search">Search</NavLink>
      </nav>
      {children}
    </div>
  );
}
