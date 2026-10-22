export default async function Page({ params }: { params: Promise<{ team: string }> }) {
  const { team } = await params;
  return <p id="members-team">{team}</p>;
}
