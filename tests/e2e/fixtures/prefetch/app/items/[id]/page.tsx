import { SlowUser } from "../../../components/slow-user";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main>
      <h1 id="items-page">Item {id}</h1>
      <SlowUser id="items-user" />
    </main>
  );
}
