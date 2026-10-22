export default async function Page() {
  const response = await fetch(`${process.env.UPSTREAM_URL}/ssg-cached`, { cache: "force-cache" });
  const data = (await response.json()) as { hit: number };
  return <p id="hit">{data.hit}</p>;
}
