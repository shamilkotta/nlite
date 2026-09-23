export const rendering = "force-ssr";

export default function Page() {
  return (
    <main data-testid="page">
      <p data-testid="rsc-marker">rsc-ok</p>
    </main>
  );
}
