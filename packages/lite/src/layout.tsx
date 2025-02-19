import React, { PropsWithChildren } from 'react';

const layout = ({ children }: PropsWithChildren) => {
  return (
    <div>
      <h1>From layout</h1>
      {children}
    </div>
  );
};

export const Error = ({ children }: PropsWithChildren) => {
  return (
    <div>
      <h1>Error</h1>
      {children}
    </div>
  );
};

export default layout;
