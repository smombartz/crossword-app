import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="text-center" style={{ padding: '80px 20px' }}>
      <h1>Puzzle Not Found</h1>
      <p className="text-body" style={{ margin: '16px 0', color: '#5a5a5a' }}>
        The puzzle you&apos;re looking for doesn&apos;t exist or has been removed.
      </p>
      <Link href="/" className="btn btn-primary" style={{ display: 'inline-block', textDecoration: 'none' }}>
        Go Home
      </Link>
    </div>
  );
}
