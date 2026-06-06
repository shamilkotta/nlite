"use client";

import React, { Component, useEffect, type ReactNode } from "react";

import { useRouter } from "./navigation/client.js";
import {
  getRedirectTypeFromError,
  getURLFromRedirectError,
  isRedirectError,
  type RedirectType,
} from "./navigation/errors.js";

interface RedirectBoundaryProps {
  children: ReactNode;
}

interface RedirectErrorBoundaryState {
  redirect: string | null;
  redirectType: RedirectType | null;
}

function HandleRedirect({
  redirect,
  redirectType,
  reset,
}: {
  redirect: string;
  redirectType: RedirectType;
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    React.startTransition(() => {
      if (redirectType === "push") {
        router.push(redirect);
      } else {
        router.replace(redirect);
      }

      reset();
    });
  }, [redirect, redirectType, reset, router]);

  return null;
}

class RedirectErrorBoundary extends Component<RedirectBoundaryProps, RedirectErrorBoundaryState> {
  constructor(props: RedirectBoundaryProps) {
    super(props);
    this.state = { redirect: null, redirectType: null };
  }

  static getDerivedStateFromError(error: unknown) {
    if (isRedirectError(error)) {
      return {
        redirect: getURLFromRedirectError(error),
        redirectType: getRedirectTypeFromError(error),
      };
    }

    throw error;
  }

  render() {
    const { redirect, redirectType } = this.state;

    if (redirect !== null && redirectType !== null) {
      return (
        <HandleRedirect
          redirect={redirect}
          redirectType={redirectType}
          reset={() => this.setState({ redirect: null, redirectType: null })}
        />
      );
    }

    return this.props.children;
  }
}

export function RedirectBoundary({ children }: RedirectBoundaryProps) {
  return <RedirectErrorBoundary>{children}</RedirectErrorBoundary>;
}
