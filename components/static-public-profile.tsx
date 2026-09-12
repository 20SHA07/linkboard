'use client';

import { useSearchParams } from 'next/navigation';
import PublicProfile from '@/components/public-profile';

export default function StaticPublicProfile() {
  const params = useSearchParams();
  return <PublicProfile username={params.get('username') || ''} />;
}
