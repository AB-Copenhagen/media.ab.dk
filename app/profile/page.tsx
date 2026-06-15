import { redirect } from 'next/navigation';
import { getCurrentUser } from '../../lib/auth';
import AppShell from '../../components/AppShell';
import ProfileClient from '../../components/ProfileClient';

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  return (
    <AppShell user={user}>
      <div className="page-header">
        <h1>My Profile</h1>
        <p>Manage your account details and security settings</p>
      </div>
      <ProfileClient />
    </AppShell>
  );
}
