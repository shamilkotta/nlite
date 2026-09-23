import Link from "nlite/link";

import { getRenderTimestamp } from "../lib/timestamp";

export default function Home() {
  return (
    <main data-testid="home">
      <p data-testid="render-mode">auto-ssg</p>
      <p data-testid="rendered-at">{getRenderTimestamp()}</p>
      <Link href="/force-ssg" data-testid="link-force-ssg">
        force-ssg
      </Link>
      <Link href="/force-ssr" data-testid="link-force-ssr">
        force-ssr
      </Link>
    </main>
  );
}
