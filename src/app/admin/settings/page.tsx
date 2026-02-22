import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { AdminSettingsClient } from './admin-settings-client';

export default async function AdminSettingsPage() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;

  if (!email || email !== process.env.ADMIN_EMAIL) {
    redirect('/');
  }

  return (
    <div>
      <h1>Generation Presets</h1>
      <p className="text-muted text-body" style={{ marginTop: 8 }}>
        Per-grid-size parameters for the puzzle generator.
      </p>
      <AdminSettingsClient />
    </div>
  );
}
