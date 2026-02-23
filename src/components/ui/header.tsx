'use client';

import Link from 'next/link';
import { useSession, signIn, signOut } from 'next-auth/react';

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL;

export function Header() {
  const { data: session, status } = useSession();
  const isLoggedIn = !!session?.user;
  const isAdmin = isLoggedIn && ADMIN_EMAIL && session.user?.email === ADMIN_EMAIL;

  return (
    <header className="flex-between" style={{ padding: '16px 0', borderBottom: '1px solid #e2e2e2', marginBottom: '24px' }}>
      <Link href="/" style={{ textDecoration: 'none', color: 'inherit' }}>
        <h1>Crossword</h1>
      </Link>
      <div className="header-actions">
        {status === 'loading' ? null : isLoggedIn ? (
          <>
            <span className="text-small text-muted">{session.user?.email}</span>
            {isAdmin && (
              <Link href="/admin/settings" className="btn btn-secondary btn-sm">Settings</Link>
            )}
            <button className="btn btn-secondary btn-sm" onClick={() => signOut()}>Log out</button>
          </>
        ) : (
          <button className="btn btn-primary btn-sm" onClick={() => signIn('google')}>Sign in</button>
        )}
      </div>
    </header>
  );
}
