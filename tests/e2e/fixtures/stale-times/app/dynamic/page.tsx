import Link from "nlite/link";
import { cookies } from "nlite/headers";

export default async function Page() {
  await cookies();
  return (
    <main>
      <h1 id="dynamic">Dynamic</h1>
      <p id="render-id">{crypto.randomUUID()}</p>
      <Link id="to-home" href="/" prefetch={false}>
        home
      </Link>
    </main>
  );
}
