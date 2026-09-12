import type { Metadata } from 'next';
import PublicProfile from '@/components/public-profile';

export const metadata: Metadata = {
  title: 'Profile',
  description: 'Find all the places that matter, together on one page.',
};

export default async function UserProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  return <PublicProfile username={username} />;
}
