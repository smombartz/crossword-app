'use client';

import Link from 'next/link';
import { useSession, signIn, signOut } from 'next-auth/react';

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL;

export function Header() {
  const { data: session, status } = useSession();
  const isLoggedIn = !!session?.user;
  const isAdmin = isLoggedIn && ADMIN_EMAIL && session.user?.email === ADMIN_EMAIL;

  return (
    <header className="flex-between app-header">
      <div>
        <Link href="/">
          <h1>Crossword Generator</h1>
        </Link>
        <p className="text-body text-muted">Create Custom Crosswords</p>
      </div>
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
          <button className="btn btn-secondary" onClick={() => {
            window.dispatchEvent(new Event('xword:before-sign-in'));
            signIn('google');
          }}>Login</button>
        )}
      </div>
    </header>
  );
}
