"use client";

import React, { Component, type ReactNode } from "react";

import { usePathname } from "./navigation/client.js";
import { isNotFoundError } from "./navigation/errors.js";

interface NotFoundBoundaryProps {
  notFound?: ReactNode;
  children?: ReactNode;
}

interface NotFoundErrorBoundaryProps extends NotFoundBoundaryProps {
  pathname: string;
}

interface NotFoundBoundaryState {
  triggered: boolean;
  previousPathname: string;
}

class NotFoundErrorBoundary extends Component<NotFoundErrorBoundaryProps, NotFoundBoundaryState> {
  constructor(props: NotFoundErrorBoundaryProps) {
    super(props);
    this.state = {
      triggered: false,
      previousPathname: props.pathname,
    };
  }

  static getDerivedStateFromError(error: unknown) {
    if (isNotFoundError(error)) {
      return { triggered: true };
    }

    throw error;
  }

  static getDerivedStateFromProps(
    props: NotFoundErrorBoundaryProps,
    state: NotFoundBoundaryState,
  ): NotFoundBoundaryState | null {
    if (props.pathname !== state.previousPathname && state.triggered) {
      return {
        triggered: false,
        previousPathname: props.pathname,
      };
    }

    return {
      triggered: state.triggered,
      previousPathname: props.pathname,
    };
  }

  render() {
    const { notFound, children } = this.props;
    const { triggered } = this.state;

    if (triggered && notFound) {
      return (
        <>
          <meta name="robots" content="noindex" />
          {notFound}
        </>
      );
    }

    return children;
  }
}

export function NotFoundBoundary({ notFound, children }: NotFoundBoundaryProps) {
  const pathname = usePathname();

  if (!notFound) {
    return children;
  }

  return (
    <NotFoundErrorBoundary pathname={pathname} notFound={notFound}>
      {children}
    </NotFoundErrorBoundary>
  );
}
