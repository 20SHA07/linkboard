import Login from '@/components/login';
export const metadata = {
  title: 'Sign in',
  description:
    'Sign in or create an account to manage your Linkboard profile, links, and analytics.',
  robots: { index: false, follow: false },
};
export default function LoginPage() {
  return <Login />;
}
