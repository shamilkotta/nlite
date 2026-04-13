import { PropsWithChildren } from "react";

type Props = {
  css: { name: string; link: string }[];
};

const Layout = ({ children, css }: PropsWithChildren<Props>) => {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        {css.map((el) => (
          <link key={el.name} rel="stylesheet" href={el.link} />
        ))}
      </head>
      <body>{children}</body>
    </html>
  );
};

export default Layout;
