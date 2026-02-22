import Link from 'next/link';

export function Header() {
  return (
    <header className="flex-between" style={{ padding: '16px 0', borderBottom: '1px solid #e2e2e2', marginBottom: '24px' }}>
      <Link href="/" style={{ textDecoration: 'none', color: 'inherit' }}>
        <h1>Crossword</h1>
      </Link>
    </header>
  );
}
