import SetupGuide from '@/components/setup-guide';

export const metadata = {
  title: 'Set up your space',
  description: 'Connect Supabase, create your account, and publish your Linkboard profile.',
  robots: { index: false, follow: false },
};

export default function SetupPage() {
  return <SetupGuide />;
}
