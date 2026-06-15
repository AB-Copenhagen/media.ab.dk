'use client';

import { UserProfile } from '@descope/react-sdk';
import { useRouter } from 'next/navigation';

export default function ProfileClient() {
  const router = useRouter();

  return (
    <UserProfile
      widgetId="user-profile-widget"
      onLogout={() => router.push('/login')}
    />
  );
}
