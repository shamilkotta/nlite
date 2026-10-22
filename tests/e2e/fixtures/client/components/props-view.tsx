"use client";

export function PropsView({
  date,
  nested,
  list,
  children,
}: {
  date: Date;
  nested: { a: { b: string } };
  list: number[];
  children: React.ReactNode;
}) {
  return (
    <div>
      <p id="prop-date">{date instanceof Date ? date.toISOString() : "not a date"}</p>
      <p id="prop-nested">{nested.a.b}</p>
      <p id="prop-list">{list.join(",")}</p>
      <div id="prop-children">{children}</div>
    </div>
  );
}
