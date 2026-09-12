'use client';
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="state-page">
      <div className="brand">
        linkboard<span>✳</span>
      </div>
      <h1>Something went off track.</h1>
      <p>Your saved profile is safe. Please try loading the page again.</p>
      <button className="button primary" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
