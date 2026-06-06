import Link from "nlite/link";

export default async function NotFound() {
  return (
    <main className="main">
      <h1>404 - Page Not Found</h1>
      <p className="muted">The page you requested does not exist.</p>
      <p>
        <Link href="/">← Back to home</Link>
      </p>
    </main>
  );
}
