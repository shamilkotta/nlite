"use client";

import React, { Component, type ComponentType, type ErrorInfo, type ReactNode } from "react";

export interface ErrorBoundaryFallbackProps {
  error: Error;
  reset: () => void;
}

export type ErrorBoundaryFallbackComponent = ComponentType<ErrorBoundaryFallbackProps>;

export interface ErrorBoundaryResetDetails {
  reason: "imperative-api" | "keys-changed";
  prev?: unknown[];
  next?: unknown[];
}

export interface ErrorBoundaryProps {
  children: ReactNode;
  FallbackComponent: ErrorBoundaryFallbackComponent;
  onError?: (error: Error, info: ErrorInfo) => void;
  onReset?: (details: ErrorBoundaryResetDetails) => void;
  resetKeys?: unknown[];
}

interface ErrorBoundaryState {
  error: Error | null;
}

const INITIAL_STATE: ErrorBoundaryState = { error: null };

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);

    this.reset = this.reset.bind(this);
    this.state = INITIAL_STATE;
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.props.onError?.(error, info);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps, prevState: ErrorBoundaryState) {
    const { error } = this.state;
    const { resetKeys } = this.props;

    if (
      error !== null &&
      prevState.error !== null &&
      hasArrayChanged(prevProps.resetKeys, resetKeys)
    ) {
      this.props.onReset?.({
        reason: "keys-changed",
        prev: prevProps.resetKeys,
        next: resetKeys,
      });
      this.setState(INITIAL_STATE);
    }
  }

  reset = () => {
    if (this.state.error === null) {
      return;
    }

    this.props.onReset?.({ reason: "imperative-api" });
    this.setState(INITIAL_STATE);
  };

  render() {
    const { children, FallbackComponent } = this.props;
    const { error } = this.state;

    if (error !== null) {
      return React.createElement(FallbackComponent, { error, reset: this.reset });
    }

    return children;
  }
}

function hasArrayChanged(prev: unknown[] = [], next: unknown[] = []) {
  return prev.length !== next.length || prev.some((item, index) => !Object.is(item, next[index]));
}
