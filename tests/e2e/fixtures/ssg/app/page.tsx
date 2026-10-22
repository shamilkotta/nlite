export default function Page() {
  return (
    <main>
      <h1 id="title">Home</h1>
      <p id="render-id">{crypto.randomUUID()}</p>
    </main>
  );
}
