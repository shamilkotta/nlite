import { cookies } from "nlite/headers";

export const SCmp = async () => {
  // const respo = await fetch("http://localhost:8000");
  // const data = await respo.json();
  // console.log({ data });
  const cookie = await cookies();
  await new Promise((resolve) => setTimeout(resolve, 5000));

  return <h1>Hello "Dynamic Content" {cookie.get("name")?.value}</h1>;
};
