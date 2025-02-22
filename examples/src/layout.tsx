import React, { PropsWithChildren } from "react";

const layout = ({ children }: PropsWithChildren) => {
  return (
    <div>
      <h1>Home layout</h1>
      {children}
    </div>
  );
};

export default layout;
