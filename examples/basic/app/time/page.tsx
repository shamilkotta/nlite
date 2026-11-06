import { headers } from "nlite/headers";

export default async function Page() {
  const headerStore = await headers();

  return (
    <main>
      <h1>Server rendering</h1>
      <p>Rendered at {new Date().toISOString()}</p>
      <p className="muted">User agent: {headerStore.get("user-agent")}</p>
    </main>
  );
}
