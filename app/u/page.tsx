import { Suspense } from 'react';
import StaticPublicProfile from '@/components/static-public-profile';

export const metadata = {
  title: 'Profile',
  description: 'Find all the places that matter, together on one page.',
};

/** A single exported page can load profiles registered after the site was built. */
export default function SharedProfilePage() {
  return (
    <Suspense
      fallback={
        <main className="public-page public-main">
          <p role="status">Loading profile…</p>
        </main>
      }
    >
      <StaticPublicProfile />
    </Suspense>
  );
}
