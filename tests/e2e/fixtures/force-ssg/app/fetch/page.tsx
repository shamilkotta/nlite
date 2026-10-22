export const rendering = "force-ssg";

export default async function Page() {
  // Uncached fetch is normally dynamic; force-ssg bakes the build-time response.
  const response = await fetch(`${process.env.UPSTREAM_URL}/force-ssg-fetch`);
  const data = (await response.json()) as { hit: number };
  return <p id="hit">{data.hit}</p>;
}
