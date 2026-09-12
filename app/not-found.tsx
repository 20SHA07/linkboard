import Link from 'next/link';
export default function NotFound() {
  return (
    <main className="state-page">
      <span className="eyebrow">404 / NOT FOUND</span>
      <h1>A link to nowhere.</h1>
      <p>This page may have moved, or the address isn’t quite right.</p>
      <Link className="button primary" href="/">
        Back to your board
      </Link>
    </main>
  );
}
