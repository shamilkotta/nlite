export const rendering = "force-ssr";

export default async function Page() {
  await new Promise((resolve) => setTimeout(resolve, 1500));

  return (
    <main>
      <h1>Slow page</h1>
      <p className="muted">loading.tsx showed while this page rendered.</p>
    </main>
  );
}
