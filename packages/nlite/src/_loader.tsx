import React, { PropsWithChildren, Suspense } from "react";
import { ErrorBoundary } from "./_error";

type Props = {
  Component?: React.FC<PropsWithChildren<any>>;
  type: "layout" | "error" | "loading" | "component";
};

const Loader = ({ children, Component, type }: PropsWithChildren<Props>) => {
  if (!Component) return children;
  if (type == "loading")
    return <Suspense fallback={<Component />}>{children}</Suspense>;
  if (type == "error")
    return (
      <ErrorBoundary fallbackRender={(props) => <Component {...props} />}>
        {children}
      </ErrorBoundary>
    );

  return <Component>{children}</Component>;
};

export default Loader;
