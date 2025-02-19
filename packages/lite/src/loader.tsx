import React, { PropsWithChildren, Suspense } from 'react';

type Props = {
  Component?: React.FC<PropsWithChildren<unknown>>;
  type: 'layout' | 'error' | 'loading' | 'component';
};

const Loader = ({ children, Component, type }: PropsWithChildren<Props>) => {
  if (!Component) return <>{children}</>;
  if (type == 'loading')
    return <Suspense fallback={<Component />}>{children}</Suspense>;

  return <Component>{children}</Component>;
};

export default Loader;
