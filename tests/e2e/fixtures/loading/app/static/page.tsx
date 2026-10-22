export default async function Page() {
  await new Promise((resolve) => setTimeout(resolve, 50));
  return <p id="content">Static content</p>;
}
