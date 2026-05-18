import Link from "nlite/link";

import { getUserPublicRecord } from "../../../lib/server/app-data";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = getUserPublicRecord(id);

  return (
    <main className="main">
      <h1>User · {user.id}</h1>
      <p className="muted">Dynamic segment + shared module (GET /api/users/:id matches).</p>
      <pre className="block">{JSON.stringify(user, null, 2)}</pre>
      <p>
        <Link href="/examples">Examples</Link>
        {" · "}
        <Link href="/">Home</Link>
      </p>
    </main>
  );
}
