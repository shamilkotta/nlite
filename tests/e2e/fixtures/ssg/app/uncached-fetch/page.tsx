export default async function Page() {
  const response = await fetch(`${process.env.UPSTREAM_URL}/ssg-uncached`);
  const data = (await response.json()) as { hit: number };
  return <p id="hit">{data.hit}</p>;
}
