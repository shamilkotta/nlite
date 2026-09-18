import { cookies } from "nlite/headers";

export const SCmp = async () => {
  // const respo = await fetch("http://localhost:8000");
  // const data = await respo.json();
  // console.log({ data });
  const cookie = await cookies();
  await new Promise((resolve) => setTimeout(resolve, 5000));

  return <h1>Hello "Dynamic Content" {cookie.get("name")?.value}</h1>;
};

export const DynamicCmp = async () => {
  const resp = await fetch("http://localhost:8000");
  const data = await resp.json();
  console.log({ data });
  return <h1>Hello "Dynamic Content"</h1>;
};

export const DynamicCmp2 = async () => {
  const resp = await fetch("http://localhost:8000", { cache: "force-cache" });
  const data = await resp.text();
  console.log("DynamicCmp2", data);
  return <h1>Hello "Dynamic Content"</h1>;
};

export const DynamicCmp3 = async () => {
  "use cache";

  await new Promise((resolve) => setTimeout(resolve, 0));
  console.log("DynamicCmp3");
  return <h1>Hello "Dynamic Content 123 31"</h1>;
};
