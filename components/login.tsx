'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';
import { getCurrentUser, isDemo, signIn, signUp } from '@/lib/data';
import { validateEmail } from '@/lib/validation';

export default function Login() {
  const router = useRouter();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => {
    if (!isDemo)
      void getCurrentUser()
        .then((user) => {
          if (user) router.replace('/');
        })
        .catch(() => {});
  }, [router]);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setMessage('');
    if (!validateEmail(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }
    if (mode === 'signup' && (password.length < 12 || password.length > 128)) {
      setError('Use a password between 12 and 128 characters.');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'signin') {
        await signIn(email.trim(), password);
        router.replace('/');
      } else {
        const result = await signUp(email.trim(), password);
        if (result.confirmationRequired) {
          setMessage(
            'Check your inbox for a confirmation link. After confirming your email, sign in to your new space.',
          );
          setPassword('');
          setMode('signin');
        } else router.replace('/');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'We couldn’t sign you in. Please try again.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-shell">
      <aside className="auth-story">
        <Link href="/" className="brand">
          linkboard<span>✳</span>
        </Link>
        <div className="auth-story-content">
          <span className="eyebrow">YOUR OWN LITTLE CORNER</span>
          <h1>
            You do a lot.
            <br />
            Give it a home.
          </h1>
          <p>A thoughtful little space for everything you create, love, and want to share.</p>
          <span className="auth-flower" aria-hidden="true">
            ✳
          </span>
        </div>
        <span className="auth-story-footer">Your links. Your style. Your corner.</span>
      </aside>
      <main className="auth-main">
        <Link href="/" className="auth-back">
          <ArrowLeft size={13} />
          Back to your board
        </Link>
        <form className="auth-form" onSubmit={submit}>
          <span className="eyebrow">MAKE YOURSELF AT HOME</span>
          <h2>{mode === 'signin' ? 'Good to have you here.' : 'A space of your own.'}</h2>
          <p>
            {mode === 'signin'
              ? 'Sign in and pick up where you left off.'
              : 'Create an account. Bring your world together.'}
          </p>
          {isDemo ? (
            <>
              <div className="auth-demo-notice">
                <strong>You’re exploring the local demo.</strong>
                <p>
                  To enable secure accounts, connect a free Supabase project using the setup
                  instructions in this project’s README. Add your environment variables, then
                  restart the app.
                </p>
                <p>Your demo works right now, with changes saved in this browser.</p>
              </div>
              <Link className="button primary full-width" href="/">
                Explore your demo
                <ArrowRight size={16} />
              </Link>
            </>
          ) : (
            <>
              <label>
                Email address
                <input
                  type="email"
                  required
                  maxLength={254}
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <label>
                Password
                <input
                  type="password"
                  required
                  maxLength={128}
                  minLength={mode === 'signup' ? 12 : undefined}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  placeholder={mode === 'signup' ? 'At least 12 characters' : 'Your password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                {mode === 'signup' && (
                  <span className="field-help">
                    Choose a unique password with at least 12 characters.
                  </span>
                )}
              </label>
              {error && (
                <div className="alert error" role="alert">
                  {error}
                </div>
              )}
              {message && (
                <div className="auth-demo-notice" role="status">
                  {message}
                </div>
              )}
              <button className="button primary full-width" disabled={busy} type="submit">
                {busy ? (
                  <Loader2 className="spin" size={16} />
                ) : (
                  <>
                    {mode === 'signin' ? 'Sign in to your space' : 'Create your account'}
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
              <div className="auth-toggle">
                {mode === 'signin' ? 'New around here?' : 'Already have a space?'}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setMode((m) => (m === 'signin' ? 'signup' : 'signin'));
                    setError('');
                    setMessage('');
                  }}
                >
                  {mode === 'signin' ? 'Create an account' : 'Sign in'}
                </button>
              </div>
            </>
          )}
          <div className="auth-divider">A HOME FOR EVERYTHING YOU DO</div>
        </form>
      </main>
    </div>
  );
}
