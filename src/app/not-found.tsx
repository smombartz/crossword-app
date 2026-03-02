import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="text-center not-found">
      <h1>Puzzle Not Found</h1>
      <p className="text-body text-muted">
        The puzzle you&apos;re looking for doesn&apos;t exist or has been removed.
      </p>
      <Link href="/" className="btn btn-primary">
        Go Home
      </Link>
    </div>
  );
}
