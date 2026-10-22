async function getStamp() {
  "use cache";
  return { id: crypto.randomUUID(), at: Date.now() };
}

export default async function Page() {
  const stamp = await getStamp();
  return <p id="stamp">{stamp.id}</p>;
}
